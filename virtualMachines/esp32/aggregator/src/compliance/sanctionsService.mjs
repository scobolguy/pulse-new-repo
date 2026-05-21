import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import { XMLParser } from 'fast-xml-parser';

const DEFAULT_OFAC_URL = 'https://www.treasury.gov/ofac/downloads/sdn.xml';
const DEFAULT_OSFI_URL = 'https://www.international.gc.ca/world-monde/assets/office_docs/international_relations-relations_internationales/sanctions/sema-lmes.xml';
const DEFAULT_REFRESH_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_THRESHOLD = 0.92;
const DEFAULT_LIMIT = 10;

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function coalesceString(...values) {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function tokenize(value) {
  return normalizeName(value).split(' ').filter(token => token.length >= 2);
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)));
}

function scoreNameMatch(query, candidate) {
  const left = normalizeName(query);
  const right = normalizeName(candidate);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length >= 6 && right.includes(left)) return 0.97;
  if (right.length >= 6 && left.includes(right)) return 0.95;

  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0;

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) intersection += 1;
  }
  if (intersection === 0) return 0;

  const leftCovered = leftTokens.length >= 2 && leftTokens.every(token => rightSet.has(token));
  const rightCovered = rightTokens.length >= 2 && rightTokens.every(token => leftSet.has(token));
  if (leftCovered || rightCovered) {
    return 0.96;
  }

  const union = new Set([...leftSet, ...rightSet]).size;
  const coverage = intersection / Math.max(leftSet.size, rightSet.size);
  const jaccard = intersection / union;
  return Math.max(0, Math.min(0.94, (coverage * 0.7) + (jaccard * 0.3)));
}

async function ensureParentDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function readJsonFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e && e.code === 'ENOENT') return null;
    throw e;
  }
}

function createParser() {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
    parseTagValue: false,
    parseAttributeValue: false
  });
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'pulse-compliance-module/1.0'
    }
  });
  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function parseOfacEntries(xmlText) {
  const parser = createParser();
  const doc = parser.parse(xmlText);
  const root = doc?.sdnList || doc;
  const entries = asArray(root?.sdnEntry).map((entry) => {
    const primaryName = uniqueStrings([
      [coalesceString(entry?.firstName), coalesceString(entry?.lastName)].filter(Boolean).join(' '),
      coalesceString(entry?.lastName),
      coalesceString(entry?.firstName)
    ])[0] || coalesceString(entry?.uid);

    const aliases = asArray(entry?.akaList?.aka).map((aka) => uniqueStrings([
      [coalesceString(aka?.firstName), coalesceString(aka?.lastName)].filter(Boolean).join(' '),
      coalesceString(aka?.lastName),
      coalesceString(aka?.firstName)
    ])[0]).filter(Boolean);

    return {
      source: 'ofac',
      sourceLabel: 'OFAC SDN',
      entryId: coalesceString(entry?.uid, primaryName),
      type: coalesceString(entry?.sdnType, 'Unknown'),
      primaryName,
      aliases: uniqueStrings(aliases),
      programs: uniqueStrings(asArray(entry?.programList?.program)),
      countries: uniqueStrings(asArray(entry?.addressList?.address).map(address => address?.country)),
      raw: {
        publishDate: root?.publshInformation?.Publish_Date || null,
        remarks: entry?.remarks || null
      }
    };
  }).filter(entry => entry.primaryName);

  return {
    source: 'ofac',
    sourceLabel: 'OFAC SDN',
    fetchedAt: new Date().toISOString(),
    publishDate: root?.publshInformation?.Publish_Date || null,
    recordCount: Number(root?.publshInformation?.Record_Count) || entries.length,
    entries
  };
}

function parseOsfiEntries(xmlText) {
  const parser = createParser();
  const doc = parser.parse(xmlText);
  const records = asArray(doc?.['data-set']?.record || doc?.dataSet?.record || doc?.record);
  const entries = records.map((record, index) => {
    const primaryName = uniqueStrings([
      [coalesceString(record?.GivenName), coalesceString(record?.LastName)].filter(Boolean).join(' '),
      coalesceString(record?.Entity),
      coalesceString(record?.LastName),
      coalesceString(record?.GivenName)
    ])[0] || `CANADA-${index + 1}`;

    const aliases = uniqueStrings([
      coalesceString(record?.Alias, record?.Aliases),
      coalesceString(record?.NameOfShip),
      coalesceString(record?.Name)
    ]).flatMap(value => String(value).split(/\s*;\s*/)).filter(Boolean);

    return {
      source: 'osfi',
      sourceLabel: 'Canadian Autonomous Sanctions List',
      entryId: coalesceString(record?.Item, record?.ReferenceNumber, `${index + 1}`),
      type: record?.Entity ? 'Entity' : 'Individual',
      primaryName,
      aliases: uniqueStrings(aliases),
      programs: uniqueStrings([record?.Country, record?.Schedule]),
      countries: uniqueStrings([record?.Country]),
      raw: {
        dateOfBirthOrShipBuildDate: record?.DateOfBirthOrShipBuildDate || null,
        title: record?.Title || null,
        schedule: record?.Schedule || null,
        dateOfListing: record?.DateOfListing || null
      }
    };
  }).filter(entry => entry.primaryName);

  return {
    source: 'osfi',
    sourceLabel: 'Canadian Autonomous Sanctions List',
    fetchedAt: new Date().toISOString(),
    publishDate: null,
    recordCount: entries.length,
    entries
  };
}

function buildIndex(sourcePayloads) {
  const entries = [];
  for (const payload of sourcePayloads) {
    for (const entry of payload.entries || []) {
      const candidateNames = uniqueStrings([entry.primaryName, ...(entry.aliases || [])]);
      entries.push({
        ...entry,
        candidateNames,
        normalizedPrimaryName: normalizeName(entry.primaryName)
      });
    }
  }
  return entries;
}

export function createSanctionsComplianceService({
  cachePath,
  logger = console,
  ofacUrl = DEFAULT_OFAC_URL,
  osfiUrl = DEFAULT_OSFI_URL,
  refreshTtlMs = DEFAULT_REFRESH_TTL_MS
} = {}) {
  let state = {
    loaded: false,
    loadedAt: null,
    sources: [],
    entries: []
  };
  let refreshPromise = null;

  async function loadFromDiskIfPresent() {
    if (state.loaded) return state;
    if (!cachePath) return state;
    const cached = await readJsonFile(cachePath);
    if (cached?.loadedAt && Array.isArray(cached?.entries)) {
      state = {
        loaded: true,
        loadedAt: cached.loadedAt,
        sources: Array.isArray(cached.sources) ? cached.sources : [],
        entries: cached.entries
      };
    }
    return state;
  }

  async function persistState() {
    if (!cachePath) return;
    await ensureParentDir(cachePath);
    await fs.writeFile(cachePath, JSON.stringify({
      loadedAt: state.loadedAt,
      sources: state.sources,
      entries: state.entries
    }, null, 2), 'utf8');
  }

  async function getStatus() {
    await loadFromDiskIfPresent();
    return {
      loaded: state.loaded,
      loadedAt: state.loadedAt,
      entryCount: state.entries.length,
      sourceCount: state.sources.length,
      sources: state.sources
    };
  }

  async function refresh({ force = true } = {}) {
    await loadFromDiskIfPresent();
    const cacheAgeMs = state.loadedAt ? Date.now() - Date.parse(state.loadedAt) : Infinity;
    if (!force && state.loaded && cacheAgeMs < refreshTtlMs) {
      return getStatus();
    }

    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      const [ofacXml, osfiXml] = await Promise.all([
        fetchText(ofacUrl),
        fetchText(osfiUrl)
      ]);

      const ofac = parseOfacEntries(ofacXml);
      const osfi = parseOsfiEntries(osfiXml);
      state = {
        loaded: true,
        loadedAt: new Date().toISOString(),
        sources: [
          {
            source: ofac.source,
            sourceLabel: ofac.sourceLabel,
            fetchedAt: ofac.fetchedAt,
            publishDate: ofac.publishDate,
            recordCount: ofac.recordCount,
            url: ofacUrl
          },
          {
            source: osfi.source,
            sourceLabel: osfi.sourceLabel,
            fetchedAt: osfi.fetchedAt,
            publishDate: osfi.publishDate,
            recordCount: osfi.recordCount,
            url: osfiUrl
          }
        ],
        entries: buildIndex([ofac, osfi])
      };
      await persistState();
      logger?.info?.(`[COMPLIANCE] Refreshed sanctions lists: ${state.entries.length} indexed names from ${state.sources.length} sources`);
      return getStatus();
    })().finally(() => {
      refreshPromise = null;
    });

    return refreshPromise;
  }

  async function ensureReady() {
    await loadFromDiskIfPresent();
    if (!state.loaded || state.entries.length === 0) {
      await refresh({ force: true });
    }
    return state;
  }

  async function screenNames(names, { threshold = DEFAULT_THRESHOLD, limit = DEFAULT_LIMIT, includeCandidates = true } = {}) {
    await ensureReady();
    const queries = uniqueStrings(asArray(names)).slice(0, 100);
    const maxResults = Math.max(1, Math.min(100, Number(limit) || DEFAULT_LIMIT));
    const resolvedThreshold = Math.max(0.5, Math.min(1, Number(threshold) || DEFAULT_THRESHOLD));
    const screenings = [];

    for (const query of queries) {
      const matches = [];
      for (const entry of state.entries) {
        let bestScore = 0;
        let matchedName = null;
        for (const candidateName of entry.candidateNames || []) {
          const score = scoreNameMatch(query, candidateName);
          if (score > bestScore) {
            bestScore = score;
            matchedName = candidateName;
          }
        }
        if (bestScore >= resolvedThreshold) {
          matches.push({
            source: entry.source,
            sourceLabel: entry.sourceLabel,
            entryId: entry.entryId,
            primaryName: entry.primaryName,
            matchedName,
            score: Number(bestScore.toFixed(4)),
            type: entry.type,
            programs: entry.programs,
            countries: entry.countries,
            aliases: includeCandidates ? entry.aliases : undefined,
            raw: entry.raw
          });
        }
      }

      matches.sort((left, right) => right.score - left.score || left.primaryName.localeCompare(right.primaryName));
      screenings.push({
        query,
        threshold: resolvedThreshold,
        hitCount: matches.length,
        matches: matches.slice(0, maxResults)
      });
    }

    return {
      screenedAt: new Date().toISOString(),
      status: await getStatus(),
      screenings
    };
  }

  return {
    getStatus,
    refresh,
    screenNames
  };
}