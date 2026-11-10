export const REFERENCE_ABI = Object.freeze({
  version: 1,
  nullHandle: 0,
  maxHandle: 0xffff,
  kinds: Object.freeze(['object', 'array', 'callable'])
});

export function isReferenceKind(kind) {
  return REFERENCE_ABI.kinds.includes(kind);
}

export function validateReferenceKind(kind) {
  if (!isReferenceKind(kind)) throw new TypeError(`Unsupported reference kind '${kind}'`);
  return kind;
}

export function validateReferenceHandle(handle) {
  if (!Number.isInteger(handle) || handle < 0 || handle > REFERENCE_ABI.maxHandle)
    throw new RangeError('Reference handle is outside the ABI range');
  return handle;
}
