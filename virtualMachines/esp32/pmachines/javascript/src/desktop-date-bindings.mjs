function jsonValue(value) {
  if (typeof value !== 'string') throw new Error('Expected serialized JSON date value');
  return JSON.parse(value);
}

export function createDesktopDateBindings() {
  return {
    'host.date_iso': value => {
      const date = new Date(jsonValue(value));
      return JSON.stringify(Number.isNaN(date.getTime()) ? null : date.toISOString());
    },
    'host.date_parse': value => {
      const timestamp = Date.parse(jsonValue(value));
      return JSON.stringify(Number.isNaN(timestamp) ? null : timestamp);
    },
    'host.date_now': () => JSON.stringify(Date.now())
  };
}
