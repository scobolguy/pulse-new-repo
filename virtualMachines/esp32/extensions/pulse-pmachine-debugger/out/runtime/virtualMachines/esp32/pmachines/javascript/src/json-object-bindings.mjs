function failure(message) { return Object.assign(new Error(message), { status: 400 }); }

function objectJson(value) {
  let parsed;
  try { parsed = JSON.parse(value); } catch { throw failure('Invalid JSON'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw failure('Expected a JSON object');
  return parsed;
}

function keyOf(key) {
  if (typeof key !== 'string' || !key.trim() || key.length > 256) throw failure('Invalid JSON key');
  return key;
}

export function createJsonObjectBindings() {
  return {
    'host.json_text': (json, key) => {
      const value = objectJson(json)[keyOf(key)];
      if (typeof value !== 'string') throw failure(`Expected string field: ${key}`);
      return value;
    },
    'host.json_value': (json, key) => {
      const object = objectJson(json);
      keyOf(key);
      if (!Object.hasOwn(object, key)) throw failure(`Missing JSON field: ${key}`);
      return JSON.stringify(object[key]);
    },
    'host.json_integer': (json, key) => {
      const value = objectJson(json)[keyOf(key)];
      if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) {
        throw failure(`Invalid integer field: ${key}`);
      }
      return value;
    },
    'host.json_set': (json, key, value) => JSON.stringify({ ...objectJson(json), [keyOf(key)]: value }),
    'host.json_embed': (json, key, value) => {
      let parsed;
      try { parsed = JSON.parse(value); } catch { throw failure('Invalid embedded JSON'); }
      return JSON.stringify({ ...objectJson(json), [keyOf(key)]: parsed });
    },
    'host.json_merge': (previous, next) => JSON.stringify({ ...objectJson(previous), ...objectJson(next) })
  };
}
