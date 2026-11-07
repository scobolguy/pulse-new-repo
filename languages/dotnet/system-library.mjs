import fs from 'node:fs';
import { convertInteger } from './integer-types.mjs';

export const SYSTEM_LIBRARY = JSON.parse(fs.readFileSync(new URL('./libraries/System/library.json', import.meta.url), 'utf8'));
export const VALUE_TYPES = new Set(SYSTEM_LIBRARY.types.filter(type => type !== 'void'));

export function resolveConsoleMember(name, usingSystem) {
  const fullName = usingSystem && name.startsWith('Console.') ? `System.${name}` : name;
  return SYSTEM_LIBRARY.members.find(member => member.name === fullName)?.name || null;
}

export function executeSystemIntrinsic(name, args) {
  const binding = SYSTEM_LIBRARY.intrinsics[name];
  if (!binding || args.length !== binding.arity) throw new TypeError(`Invalid System intrinsic: ${name}`);
  if (name === 'system.integer.convert') {
    if (![0, 1].includes(args[2])) throw new TypeError('Integer conversion requires an explicit overflow mode');
    return convertInteger(args[0], args[1], args[2] === 1);
  }
  for (const value of args) {
    if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647)
      throw new TypeError(`${name} requires Int32 arguments`);
  }
  if (name === 'system.int32.tostring') return String(args[0]);
  const [left, right] = args;
  if (['system.int32.add', 'system.int32.subtract', 'system.int32.multiply'].includes(name)) {
    const a = BigInt(left), b = BigInt(right);
    const result = name.endsWith('.add') ? a + b : name.endsWith('.subtract') ? a - b : a * b;
    if (result < -2147483648n || result > 2147483647n) throw new RangeError('System.OverflowException');
    return Number(result);
  }
  if (right === 0) throw new RangeError('System.DivideByZeroException');
  if (left === -2147483648 && right === -1) throw new RangeError('System.OverflowException');
  if (name === 'system.int32.remainder') return (left % right) | 0;
  return Math.trunc(left / right) | 0;
}
