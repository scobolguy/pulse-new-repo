import fs from 'node:fs';
import { convertInteger } from './integer-types.mjs';

export const SYSTEM_LIBRARY = JSON.parse(fs.readFileSync(new URL('./libraries/System/library.json', import.meta.url), 'utf8'));
export const VALUE_TYPES = new Set(SYSTEM_LIBRARY.types.filter(type => type !== 'void'));
for (const type of ['int-array', 'bool-array', 'byte-array', 'short-array']) VALUE_TYPES.add(type);

export function resolveConsoleMember(name, usingSystem) {
  const fullName = usingSystem && name.startsWith('Console.') ? `System.${name}` : name;
  return SYSTEM_LIBRARY.members.find(member => member.name === fullName)?.name || null;
}

export function executeSystemIntrinsic(name, args) {
  const binding = SYSTEM_LIBRARY.intrinsics[name];
  if (!binding || args.length !== binding.arity) throw new TypeError(`Invalid System intrinsic: ${name}`);
  if (name === 'system.string.length') {
    if (typeof args[0] !== 'string') throw new TypeError('String length requires a string');
    for (const character of args[0]) {
      const code = character.codePointAt(0);
      if (code >= 0xd800 && code <= 0xdfff) throw new TypeError('String length requires valid Unicode');
    }
    return args[0].length;
  }
  if (name === 'system.reference.notnull') {
    if (args.length !== 1 || args[0] === null || args[0] === undefined || args[0] === 0)
      throw new Error('NullPointerException: non-null assertion failed');
    return args[0];
  }
  if (name === 'system.exception.throw') {
    if (args.length !== 1) throw new TypeError('Kotlin throw requires one value');
    throw new Error(`KotlinThrow: ${String(args[0])}`);
  }
  if (name === 'system.assert.equals') {
    if (!args.every(Number.isInteger))
      throw new TypeError('Assertion equality requires Int32 arguments');
    if (args[0] !== args[1])
      throw new Error(`AssertionError: expected ${args[0]}, actual ${args[1]}`);
    return undefined;
  }
  if (name === 'system.coroutine.yield') return undefined;
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
  if (left === -2147483648 && right === -1 && !name.endsWith('.unchecked'))
    throw new RangeError('System.OverflowException');
  if (name.startsWith('system.int32.remainder')) return (left % right) | 0;
  return Math.trunc(left / right) | 0;
}
