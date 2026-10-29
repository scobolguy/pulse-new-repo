import fs from 'node:fs';

export const SYSTEM_LIBRARY = JSON.parse(fs.readFileSync(new URL('./libraries/System/library.json', import.meta.url), 'utf8'));
export const VALUE_TYPES = new Set(SYSTEM_LIBRARY.types.filter(type => type !== 'void'));

export function resolveConsoleMember(name, usingSystem) {
  const fullName = usingSystem && name.startsWith('Console.') ? `System.${name}` : name;
  return SYSTEM_LIBRARY.members.find(member => member.name === fullName)?.name || null;
}

export function executeSystemIntrinsic(name, args) {
  const binding = SYSTEM_LIBRARY.intrinsics[name];
  if (!binding || args.length !== binding.arity) throw new TypeError(`Invalid System intrinsic: ${name}`);
  for (const value of args) {
    if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647)
      throw new TypeError(`${name} requires Int32 arguments`);
  }
  const [left, right] = args;
  if (right === 0) throw new RangeError('System.DivideByZeroException');
  if (name === 'system.int32.remainder') return (left % right) | 0;
  if (left === -2147483648 && right === -1) throw new RangeError('System.OverflowException');
  return Math.trunc(left / right) | 0;
}
