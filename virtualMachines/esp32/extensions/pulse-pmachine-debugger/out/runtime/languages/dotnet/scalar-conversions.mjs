import { fail } from './source-diagnostics.mjs';
import { isInteger, convertInteger } from './integer-types.mjs';

export function scalarConversion(source, target, token) {
  if (source === target) return 'identity';
  if (isInteger(source) && isInteger(target)) return 'integer';
  if (token.sourceLanguage === 'vbish') {
    if (source === 'bool' && isInteger(target)) return 'boolean-to-integer';
    if (isInteger(source) && target === 'bool') return 'integer-to-boolean';
    if ((isInteger(source) || source === 'bool') && target === 'string') return 'scalar-to-string';
  }
  fail(token, `Unsupported explicit conversion from '${source}' to '${target}'`);
}

export function convertScalarConstant(value, conversion, target, checked = true) {
  switch (conversion) {
    case 'identity': return value;
    case 'integer': return convertInteger(value, target, checked);
    case 'boolean-to-integer': {
      const bits = target === 'byte' ? 255 : target === 'ushort' ? 65535 : -1;
      return value ? bits : 0;
    }
    case 'integer-to-boolean': return value !== 0;
    case 'scalar-to-string': return typeof value === 'boolean' ? value ? 'True' : 'False' : String(value);
    default: throw new Error(`Unknown scalar conversion '${conversion}'`);
  }
}
