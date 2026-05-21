function getNestedValue(obj, path) {
  let current = obj;
  for (const segment of path) {
    if (current == null) return null;
    current = current[segment];
  }
  return current == null ? null : current;
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)));
}

function detectMessageType(messageType, message) {
  const explicit = String(messageType || '').trim().toLowerCase();
  if (explicit) return explicit;
  if (typeof message === 'string' && message.toUpperCase().includes('MT103')) return 'swift-mt103';
  if (message && typeof message === 'object' && message.Document) return 'pacs';
  return 'unknown';
}

function extractSwiftBlockFieldLines(messageText, prefixes) {
  const lines = String(messageText || '').split(/\r?\n/);
  const normalizedPrefixes = prefixes.map(prefix => String(prefix || '').toUpperCase());
  for (let index = 0; index < lines.length; index += 1) {
    const line = String(lines[index] || '');
    const upper = line.toUpperCase();
    const matchedPrefix = normalizedPrefixes.find(prefix => upper.startsWith(prefix));
    if (!matchedPrefix) continue;

    const values = [];
    const inlineValue = line.slice(matchedPrefix.length).trim();
    if (inlineValue && !inlineValue.startsWith('/')) {
      values.push(inlineValue);
    }

    for (let inner = index + 1; inner < lines.length; inner += 1) {
      const nextLine = String(lines[inner] || '').trim();
      if (!nextLine) continue;
      if (nextLine.startsWith(':')) break;
      if (nextLine.startsWith('/')) continue;
      values.push(nextLine);
    }

    const preferred = values.find(value => /[A-Za-z]/.test(value) && !/^[A-Z0-9]{6,}$/.test(value));
    return preferred || values[0] || null;
  }
  return null;
}

function extractMt103Parties(message) {
  if (typeof message !== 'string') return [];
  return uniqueStrings([
    extractSwiftBlockFieldLines(message, [':50A:', ':50F:', ':50K:']),
    extractSwiftBlockFieldLines(message, [':59:', ':59A:', ':59F:'])
  ]);
}

function firstNonEmptyPath(message, paths) {
  for (const path of paths) {
    const value = getNestedValue(message, path);
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function extractPacsParties(message) {
  if (!message || typeof message !== 'object') return [];
  return uniqueStrings([
    firstNonEmptyPath(message, [
      ['Document', 'FIToFICstmrCdtTrf', 'CdtTrfTxInf', 0, 'Dbtr', 'Nm'],
      ['Document', 'CstmrCdtTrfInitn', 'PmtInf', 0, 'CdtTrfTxInf', 0, 'Dbtr', 'Nm'],
      ['Document', 'CstmrCdtTrfInitn', 'PmtInf', 'CdtTrfTxInf', 0, 'Dbtr', 'Nm']
    ]),
    firstNonEmptyPath(message, [
      ['Document', 'FIToFICstmrCdtTrf', 'CdtTrfTxInf', 0, 'Cdtr', 'Nm'],
      ['Document', 'CstmrCdtTrfInitn', 'PmtInf', 0, 'CdtTrfTxInf', 0, 'Cdtr', 'Nm'],
      ['Document', 'CstmrCdtTrfInitn', 'PmtInf', 'CdtTrfTxInf', 0, 'Cdtr', 'Nm']
    ])
  ]);
}

function extractTransactionParties(messageType, message) {
  const normalizedType = detectMessageType(messageType, message);
  if (normalizedType === 'swift-mt103' || normalizedType === 'mt103') {
    return {
      messageType: 'swift-mt103',
      parties: extractMt103Parties(message)
    };
  }
  if (normalizedType === 'pacs' || normalizedType.startsWith('pacs')) {
    return {
      messageType: 'pacs',
      parties: extractPacsParties(message)
    };
  }
  return {
    messageType: normalizedType,
    parties: []
  };
}

export function registerComplianceRoutes(app, deps) {
  const {
    requirePermission,
    resolveActor,
    formatErrorDetails,
    sanctionsComplianceService
  } = deps;

  app.get('/api/compliance/sanctions/status', requirePermission('lifecycle.read'), async (req, res) => {
    try {
      const status = await sanctionsComplianceService.getStatus();
      return res.json({ ok: true, status });
    } catch (e) {
      return res.status(500).json({ ok: false, error: formatErrorDetails(e) });
    }
  });

  app.post('/api/compliance/sanctions/refresh', requirePermission('lifecycle.manage'), async (req, res) => {
    try {
      const actor = req.actor || resolveActor(req);
      const status = await sanctionsComplianceService.refresh({
        force: req.body?.force !== false,
        actorUserId: actor?.userId || null
      });
      return res.json({ ok: true, status });
    } catch (e) {
      return res.status(500).json({ ok: false, error: formatErrorDetails(e) });
    }
  });

  app.post('/api/compliance/sanctions/screen', requirePermission('lifecycle.read'), async (req, res) => {
    try {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      const names = Array.isArray(req.body?.names) ? req.body.names : [];
      const candidates = [...names, ...(name ? [name] : [])]
        .map(value => String(value || '').trim())
        .filter(Boolean);

      if (candidates.length === 0) {
        return res.status(400).json({ ok: false, error: 'Provide name or names[] to screen' });
      }

      const threshold = Number(req.body?.threshold);
      const result = await sanctionsComplianceService.screenNames(candidates, {
        threshold: Number.isFinite(threshold) ? threshold : undefined,
        limit: req.body?.limit,
        includeCandidates: req.body?.includeCandidates !== false
      });

      return res.json({ ok: true, ...result });
    } catch (e) {
      return res.status(500).json({ ok: false, error: formatErrorDetails(e) });
    }
  });

  app.post('/api/compliance/transactions/screen', requirePermission('lifecycle.read'), async (req, res) => {
    try {
      const message = req.body?.message;
      const extracted = extractTransactionParties(req.body?.messageType || req.body?.type, message);
      if (extracted.parties.length === 0) {
        return res.status(400).json({
          ok: false,
          error: 'Could not extract screenable party names from transaction payload',
          messageType: extracted.messageType
        });
      }

      const threshold = Number(req.body?.threshold);
      const result = await sanctionsComplianceService.screenNames(extracted.parties, {
        threshold: Number.isFinite(threshold) ? threshold : undefined,
        limit: req.body?.limit,
        includeCandidates: req.body?.includeCandidates !== false
      });

      return res.json({
        ok: true,
        messageType: extracted.messageType,
        extractedParties: extracted.parties,
        screening: result
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: formatErrorDetails(e) });
    }
  });
}