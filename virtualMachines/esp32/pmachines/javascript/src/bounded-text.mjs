export function createBoundedTextBindings() {
  const bounded = value => {
    if (typeof value !== 'string' || Buffer.byteLength(value) > 1024 || /[^\x00-\x7f]/.test(value)) throw new Error('Invalid ASCII text bounds');
    return value;
  };
  return {
    'host.text_lower': value => bounded(value).replace(/[A-Z]/g, ch => ch.toLowerCase()),
    'host.text_index': (value, needle) => bounded(value).indexOf(bounded(needle)),
    'host.text_slice': (value, start, count) => {
      const bytes = Buffer.from(bounded(value));
      if (!Number.isInteger(start) || !Number.isInteger(count) || start < 0 || count < 0 ||
          start > bytes.length || count > bytes.length - start) throw new Error('Invalid text slice');
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(start, start + count));
    },
    'host.text_header': (value, requested) => {
      bounded(value);
      if (!value.length || typeof requested !== 'string' || Buffer.byteLength(requested) > 64) throw new Error('Invalid header text bounds');
      const lines = value.split('\r\n');
      if (lines.length < 3 || lines.length > 33 || lines.at(-1) !== '' || lines.at(-2) !== '' || !lines[0]) throw new Error('Invalid header line framing or bounds');
      let result = requested === '' ? lines[0] : '', found = false;
      for (let index = 0; index < lines.length - 2; index++) {
        const line = lines[index];
        if (!line.length || Buffer.byteLength(line) > 256 || /[^\t\x20-\x7e]/.test(line)) throw new Error('Invalid header character or bounds');
        if (index === 0) continue;
        const colon = line.indexOf(':');
        if (colon < 1 || colon > 64 || !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(line.slice(0, colon))) throw new Error('Invalid header name');
        if (line.slice(0, colon).toLowerCase() === requested.toLowerCase()) {
          if (found) throw new Error('Duplicate header');
          found = true; result = line.slice(colon + 1).replace(/^[ \t]+|[ \t]+$/g, '');
        }
      }
      return result;
    }
  };
}
