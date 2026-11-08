export const INTEGER_TYPES = Object.freeze({
  sbyte: { bits: 8, signed: true, min: -128, max: 127 },
  byte: { bits: 8, signed: false, min: 0, max: 255 },
  short: { bits: 16, signed: true, min: -32768, max: 32767 },
  ushort: { bits: 16, signed: false, min: 0, max: 65535 },
  int: { bits: 32, signed: true, min: -2147483648, max: 2147483647 }
});

export function isInteger(type) { return Object.hasOwn(INTEGER_TYPES, type); }
export function fitsInteger(value, type) {
  const bounds = INTEGER_TYPES[type];
  return Boolean(bounds) && value >= bounds.min && value <= bounds.max;
}
export function widensInteger(source, target) {
  if (!isInteger(source) || !isInteger(target)) return false;
  return INTEGER_TYPES[source].min >= INTEGER_TYPES[target].min
    && INTEGER_TYPES[source].max <= INTEGER_TYPES[target].max;
}
export function implicitConversion(source, target, node, language) {
  if (language === 'kotlin')
    return source === target || source === 'int' && ['sbyte', 'short'].includes(target)
      && Object.hasOwn(node, 'constant') && fitsInteger(node.constant, target);
  return source === target || widensInteger(source, target)
    || (source === 'int' || language === 'vbish' && isInteger(source))
      && isInteger(target) && Object.hasOwn(node, 'constant')
      && fitsInteger(node.constant, target)
      && (language === 'vbish' || target !== 'int');
}
export function integerResult(left, right, language) {
  if (!isInteger(left) || !isInteger(right)) return null;
  if (language !== 'vbish') return 'int';
  return ['sbyte', 'byte', 'short', 'ushort', 'int']
    .find(type => widensInteger(left, type) && widensInteger(right, type));
}
export function convertInteger(value, target, checked) {
  if (!Number.isInteger(value) || !fitsInteger(value, 'int'))
    throw new TypeError('Integer conversion requires an Int32 value');
  const bounds = INTEGER_TYPES[target];
  if (!bounds) throw new TypeError(`Unsupported integer conversion target '${target}'`);
  if (checked && !fitsInteger(value, target)) throw new RangeError('System.OverflowException');
  const result = bounds.signed ? BigInt.asIntN(bounds.bits, BigInt(value)) : BigInt.asUintN(bounds.bits, BigInt(value));
  return Number(result);
}
