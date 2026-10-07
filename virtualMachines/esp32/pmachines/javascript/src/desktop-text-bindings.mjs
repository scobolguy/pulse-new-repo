export function createDesktopTextBindings() {
  const text = value => {
    if (typeof value !== 'string') throw Object.assign(new Error('Expected string text'), { status: 400 });
    return value;
  };
  return {
    'host.text_trim': value => text(value).trim(),
    'host.text_split': (value, separator) => JSON.stringify(text(value).split(text(separator))),
    'host.string_lower': value => text(value).toLowerCase(),
    'host.string_upper': value => text(value).toUpperCase(),
    'host.string_replace': (value, pattern, flags, replacement) => {
      text(value); text(pattern); text(flags); text(replacement);
      if (pattern.length > 256 || !/^[gi]*$/.test(flags) || new Set(flags).size !== flags.length) {
        throw Object.assign(new Error('Invalid text replacement pattern or flags'), { status: 400 });
      }
      return value.replace(new RegExp(pattern, flags), replacement);
    },
    'host.string_compare': (left, right) => Math.sign(text(left).localeCompare(text(right))),
    'host.number_parse_integer': value => {
      const parsed = Number.parseInt(text(value), 10);
      return JSON.stringify(Number.isFinite(parsed) ? parsed : 0);
    },
    'host.number_compare': (left, right) => {
      const a = JSON.parse(text(left)), b = JSON.parse(text(right));
      if (typeof a !== 'number' || typeof b !== 'number') throw new Error('Expected numeric JSON values');
      return a === b ? 0 : a < b ? -1 : 1;
    },
    'host.string_index': (value, needle) => text(value).indexOf(text(needle)),
    'host.string_slice': (value, start, end) => {
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) {
        throw Object.assign(new Error('Invalid string slice'), { status: 400 });
      }
      return text(value).slice(start, end);
    }
  };
}
