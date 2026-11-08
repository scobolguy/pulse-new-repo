const trimCopy = value => String(value || '').trim();

export function getByPath(source, dottedPath) {
  const parts = String(dottedPath || '').split('.').map(p => p.trim()).filter(Boolean);
  let cursor = source;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object' || !(part in cursor)) {
      return undefined;
    }
    cursor = cursor[part];
  }
  return cursor;
}

export function getJsonPathValue(root, dotPath) {
  const parts = String(dotPath || '').split('.').map(trimCopy).filter(Boolean);
  if (String(parts[0] || '').toLowerCase() === 'source') parts.shift();
  let cur = root;
  for (const key of parts) {
    if (!cur || typeof cur !== 'object' || !(key in cur)) return '';
    cur = cur[key];
  }

  return cur;
}

export function setJsonPathValue(root, dotPath, value) {
  const parts = String(dotPath || '').split('.').map(trimCopy).filter(Boolean);
  if (String(parts[0] || '').toLowerCase() === 'target') parts.shift();
  let cur = root;
  for (let i = 0; i < parts.length; i += 1) {
    const key = parts[i];
    if (i === parts.length - 1) {
      cur[key] = value;
      return;
    }
    if (!cur[key] || typeof cur[key] !== 'object' || Array.isArray(cur[key])) {
      cur[key] = {};
    }
    cur = cur[key];
  }
}
