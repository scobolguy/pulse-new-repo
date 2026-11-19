export function counterImage() {
  const i = (op, operand = '', target = 0, argCount = 0) => ({ op, operand, target, argCount });
  return {
    formatVersion: 1, abi: 'pulse-scalar-v1', moduleId: 'counter@exact-content', contentHash: '',
    instructions: [
      i('LOAD', 'counter'), i('PUSH_INT', '1'), i('ADD'), i('STORE', 'counter'),
      i('LOAD', 'x'), i('CALL', '', 9, 1), i('LOAD', 'counter'), i('ADD'), i('RET'),
      i('LOAD', 'n'), i('PUSH_INT', '2'), i('MUL'), i('RET'),
    ],
    entries: [
      { entry: 0, params: ['x'], returnsValue: true },
      { entry: 9, params: ['n'], returnsValue: true },
    ],
    globals: ['counter'],
  };
}
