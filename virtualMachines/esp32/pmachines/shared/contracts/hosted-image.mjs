import { parsePcode } from '../../javascript/src/runtime.mjs';
import { SERVICE_HOST_BINDINGS } from './service-host-bindings.mjs';

// PHI1 uses hex-encoded fixed-width records so the existing text FFS upload
// transports it losslessly. Offsets address decoded UTF-8 constant bytes.
export const HOSTED_IMAGE_OPCODES = Object.freeze({
  NOP: 0x00, JMP: 0x07, JZ: 0x08, PUSH_INT: 0x09, PUSH_STR: 0x0a,
  ADD: 0x0c, SUB: 0x0d, MUL: 0x0e, DIV: 0x0f,
  LOAD: 0x18, LOAD_NAME: 0x18, STORE: 0x19, STORE_NAME: 0x19,
  CALL: 0x1a, RET: 0x1b, EQ: 0x1c, NEQ: 0x1d, LT: 0x1e,
  LE: 0x1f, GT: 0x20, GE: 0x21, CALL_EXT: 0x29,
  OR: 0x4b, AND: 0x4c, NOT: 0x4d, STREQ: 0x4e, STRNEQ: 0x4f,
  MAP_RETURN: 0x50, HALT: 0xff
});

export function encodeHostedImage(pcodeText) {
  const instructions = parsePcode(pcodeText);
  if (!instructions.length || instructions.length > 512) throw new Error('Hosted image instruction capacity exceeded');
  const constants = [];
  const offsets = new Map();
  let constantBytes = 0;
  const records = instructions.map(instruction => {
    const { mnemonic, operand, targetIndex } = instruction;
    const opcode = HOSTED_IMAGE_OPCODES[mnemonic];
    if (opcode === undefined) throw new Error(`Unsupported hosted image opcode: ${mnemonic}`);
    let value = 0, argc = 0, text = '';
    if (['JMP', 'JZ', 'CALL'].includes(mnemonic)) {
      if (targetIndex < 0 || targetIndex >= instructions.length) throw new Error('Invalid hosted image branch target');
      value = targetIndex;
    }
    if (mnemonic === 'PUSH_INT') {
      if (!Number.isInteger(operand) || operand < -2147483648 || operand > 2147483647)
        throw new Error('Invalid hosted image integer');
      value = operand;
    }
    if (mnemonic === 'CALL' || mnemonic === 'CALL_EXT') {
      argc = operand.argc;
      text = operand.label;
      if (!Number.isInteger(argc) || argc < 0 || argc > 8) throw new Error('Invalid hosted image arity');
      if (mnemonic === 'CALL_EXT' && SERVICE_HOST_BINDINGS[text]?.arity !== argc)
        throw new Error('Invalid hosted image binding');
    } else if (['PUSH_STR', 'LOAD', 'LOAD_NAME', 'STORE', 'STORE_NAME', 'MAP_RETURN'].includes(mnemonic)) {
      text = operand;
    }
    const bytes = Buffer.from(text, 'utf8');
    if (bytes.includes(0)) throw new Error('NUL in hosted image constant');
    if (bytes.length > 2048) throw new Error('Hosted image constant capacity exceeded');
    if (!offsets.has(text)) {
      offsets.set(text, constantBytes);
      constants.push(bytes);
      constantBytes += bytes.length;
    }
    const record = Buffer.alloc(12);
    record.writeUInt8(opcode, 0);
    record.writeUInt8(argc, 1);
    record.writeInt32BE(value, 2);
    record.writeUInt32BE(offsets.get(text), 6);
    record.writeUInt16BE(bytes.length, 10);
    return record.toString('hex');
  });
  const image = `PHI1${instructions.length.toString(16).padStart(8, '0')}${constantBytes.toString(16).padStart(8, '0')}`
    + records.join('') + Buffer.concat(constants).toString('hex');
  if (image.length > 32768) throw new Error('Hosted image file capacity exceeded');
  return image;
}
