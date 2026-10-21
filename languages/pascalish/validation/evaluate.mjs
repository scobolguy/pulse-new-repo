export function checkOutput(result, expected) {
  const runtimeError = result.runtimeError || result.error
    || result.state?.__runtime_error || result.state?.__thunk_error || result.state?.__orch_error;
  if (runtimeError) return { status: 'fail', reason: `Runtime error: ${runtimeError}` };
  if (result.stepLimitHit) return { status: 'fail', reason: 'Execution step limit reached' };
  if (!Array.isArray(result.stdout)) return { status: 'fail', reason: 'Missing stdout array' };
  if (JSON.stringify(result.stdout) !== JSON.stringify(expected)) {
    return { status: 'fail', reason: 'stdout does not exactly match expected output' };
  }
  return { status: 'pass' };
}

export function checkNegative(result, diagnostic) {
  if (result.stage === 'compile-error') {
    if (result.error.includes('Parse failed:')) {
      return { status: 'blocked', reason: 'Syntax rejected before generic semantics could be validated' };
    }
    if (new RegExp(diagnostic, 'i').test(result.error)) return { status: 'pass' };
    return { status: 'fail', reason: 'Compilation failed without the required generic diagnostic' };
  }
  return { status: 'fail', reason: 'Invalid generic program was accepted' };
}
