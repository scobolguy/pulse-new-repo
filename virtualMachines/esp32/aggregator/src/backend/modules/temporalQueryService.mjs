import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_TIME_ZONE = 'America/New_York';
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const TIME_ZONE_ALIASES = {
  'eastern time': 'America/New_York', eastern: 'America/New_York', 'new york': 'America/New_York', boston: 'America/New_York', miami: 'America/New_York', toronto: 'America/Toronto', montreal: 'America/Toronto', ottawa: 'America/Toronto',
  'central time': 'America/Chicago', chicago: 'America/Chicago', dallas: 'America/Chicago', winnipeg: 'America/Winnipeg',
  'mountain time': 'America/Denver', denver: 'America/Denver', calgary: 'America/Edmonton',
  'pacific time': 'America/Los_Angeles', 'los angeles': 'America/Los_Angeles', seattle: 'America/Los_Angeles', vancouver: 'America/Vancouver',
  london: 'Europe/London', 'united kingdom': 'Europe/London', uk: 'Europe/London', paris: 'Europe/Paris', berlin: 'Europe/Berlin', rome: 'Europe/Rome', madrid: 'Europe/Madrid', amsterdam: 'Europe/Amsterdam', zurich: 'Europe/Zurich', moscow: 'Europe/Moscow',
  singapore: 'Asia/Singapore', tokyo: 'Asia/Tokyo', seoul: 'Asia/Seoul', beijing: 'Asia/Shanghai', shanghai: 'Asia/Shanghai', hongkong: 'Asia/Hong_Kong', 'hong kong': 'Asia/Hong_Kong', mumbai: 'Asia/Kolkata', delhi: 'Asia/Kolkata', dubai: 'Asia/Dubai', jakarta: 'Asia/Jakarta', bangkok: 'Asia/Bangkok', manila: 'Asia/Manila',
  sydney: 'Australia/Sydney', melbourne: 'Australia/Melbourne', perth: 'Australia/Perth', auckland: 'Pacific/Auckland',
  cairo: 'Africa/Cairo', johannesburg: 'Africa/Johannesburg', nairobi: 'Africa/Nairobi', lagos: 'Africa/Lagos',
  'sao paulo': 'America/Sao_Paulo', 'são paulo': 'America/Sao_Paulo', 'buenos aires': 'America/Argentina/Buenos_Aires', mexico: 'America/Mexico_City', 'mexico city': 'America/Mexico_City'
};

function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timeZone.trim() }).format(0);
    return true;
  } catch {
    return false;
  }
}

function canonicalTimeZone(timeZone) {
  if (!isValidTimeZone(timeZone)) return null;
  return new Intl.DateTimeFormat('en-US', { timeZone: timeZone.trim() }).resolvedOptions().timeZone;
}

function resolveTimeZone(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const normalized = raw.toLowerCase().replace(/[?.!,]+$/g, '').trim();
  if (TIME_ZONE_ALIASES[normalized]) return TIME_ZONE_ALIASES[normalized];
  const canonical = canonicalTimeZone(raw);
  if (canonical) return canonical;
  const alias = Object.keys(TIME_ZONE_ALIASES)
    .sort((left, right) => right.length - left.length)
    .find(candidate => new RegExp(`\\b${candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(normalized));
  return alias ? TIME_ZONE_ALIASES[alias] : null;
}

function zonedParts(epochMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
    timeZoneName: 'short'
  }).formatToParts(new Date(epochMs));
  const get = type => parts.find(part => part.type === type)?.value || '';
  return {
    year: Number(get('year')),
    monthName: get('month'),
    day: Number(get('day')),
    weekday: get('weekday'),
    time: `${get('hour')}:${get('minute')}:${get('second')} ${get('dayPeriod')}`,
    zoneName: get('timeZoneName')
  };
}

function parseCalendarDate(query, localYear) {
  const normalized = String(query || '').toLowerCase();
  for (let monthIndex = 0; monthIndex < MONTH_NAMES.length; monthIndex += 1) {
    const monthName = MONTH_NAMES[monthIndex];
    const match = normalized.match(new RegExp(`\\b${monthName.toLowerCase()}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`));
    if (!match) continue;
    const day = Number(match[1]);
    const year = Number(match[2] || localYear);
    const date = new Date(Date.UTC(year, monthIndex, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== monthIndex || date.getUTCDate() !== day) {
      throw new Error(`${monthName} ${day} is not a valid date in ${year}`);
    }
    return { year, month: monthIndex + 1, monthName, day, date };
  }
  return null;
}

export function createTemporalQueryService({
  nowProvider = () => Date.now(),
  preferencesPath = path.resolve('data/user-timezone-preferences.json'),
  defaultTimeZone = DEFAULT_TIME_ZONE
} = {}) {
  let preferences = {};
  try {
    preferences = JSON.parse(fs.readFileSync(preferencesPath, 'utf8'));
  } catch {
    preferences = {};
  }

  function getUserTimeZone(userId = 'system-admin') {
    const stored = preferences[String(userId || 'system-admin')];
    return canonicalTimeZone(stored) || canonicalTimeZone(defaultTimeZone) || DEFAULT_TIME_ZONE;
  }

  function setUserTimeZone(userId, requestedZone) {
    const timeZone = resolveTimeZone(requestedZone);
    if (!timeZone) throw new Error(`Unknown city or time zone: ${requestedZone}`);
    preferences[String(userId || 'system-admin')] = timeZone;
    fs.mkdirSync(path.dirname(preferencesPath), { recursive: true });
    const tempPath = `${preferencesPath}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(preferences, null, 2)}\n`, 'utf8');
    fs.renameSync(tempPath, preferencesPath);
    return timeZone;
  }

  function query({ query: rawQuery = '', userId = 'system-admin' } = {}) {
    const queryText = String(rawQuery || '').trim();
    const setMatch = queryText.match(/\b(?:set|change|update)\s+(?:my\s+)?time\s*zone\s+(?:to|as)\s+(.+?)\s*[?.!]*$/i);
    if (setMatch) {
      const timeZone = setUserTimeZone(userId, setMatch[1]);
      const current = zonedParts(nowProvider(), timeZone);
      return { kind: 'timezone-set', timeZone, current, userId: String(userId), authoritativeNow: new Date(nowProvider()).toISOString() };
    }

    const explicitLocationMatch = queryText.match(/\b(?:in|for)\s+([A-Za-zÀ-ž][A-Za-zÀ-ž ._/-]+?)\s*[?.!]*$/i);
    const explicitTimeZone = resolveTimeZone(explicitLocationMatch?.[1] || '');
    const userTimeZone = getUserTimeZone(userId);
    const timeZone = explicitTimeZone || userTimeZone;
    const nowMs = nowProvider();
    const current = zonedParts(nowMs, timeZone);
    const calendarDate = parseCalendarDate(queryText, current.year);

    if (calendarDate) {
      const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' }).format(calendarDate.date);
      return {
        kind: 'date-weekday', timeZone, userTimeZone, usedExplicitTimeZone: Boolean(explicitTimeZone),
        date: `${calendarDate.year}-${String(calendarDate.month).padStart(2, '0')}-${String(calendarDate.day).padStart(2, '0')}`,
        year: calendarDate.year, month: calendarDate.month, monthName: calendarDate.monthName, day: calendarDate.day, weekday,
        authoritativeNow: new Date(nowMs).toISOString()
      };
    }

    return {
      kind: 'current-time', timeZone, userTimeZone, usedExplicitTimeZone: Boolean(explicitTimeZone), current,
      authoritativeNow: new Date(nowMs).toISOString()
    };
  }

  return { query, getUserTimeZone, setUserTimeZone, resolveTimeZone };
}

export { DEFAULT_TIME_ZONE, TIME_ZONE_ALIASES };