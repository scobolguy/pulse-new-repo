import { isDeepStrictEqual } from 'node:util';

export function evaluate(test, actual) {
  const failure = reason => ({ status: 'fail', reason });
  if (!actual || typeof actual !== 'object') return failure('Worker returned no structured result');
  if (test.kind === 'negative' || test.kind === 'unsupported') {
    if (actual.stage !== 'compile-error') return failure('Source was accepted, but a compiler diagnostic was required');
    if (actual.errorName !== 'SyntaxError') return failure(`Compiler crashed rather than diagnosing source: ${actual.errorName}: ${actual.diagnostic}`);
    if (!new RegExp(test.diagnostic).test(actual.diagnostic)) return failure(`Wrong compiler diagnostic: ${actual.diagnostic}`);
    return { status: test.kind === 'unsupported' ? 'unsupported' : 'pass', reason: actual.diagnostic };
  }
  if (test.kind === 'runtime-error') {
    if (actual.stage !== 'runtime-error') return failure(`Expected a runtime fault, received ${actual.stage}`);
    if (actual.errorName !== test.errorName || !new RegExp(test.diagnostic).test(actual.diagnostic))
      return failure(`Wrong runtime fault: ${actual.errorName}: ${actual.diagnostic}`);
    return { status: 'pass' };
  }
  if (actual.stage !== 'executed') return failure(`Expected execution, received ${actual.stage}: ${actual.diagnostic || ''}`);
  const result = actual.result;
  if (!result || !Array.isArray(result.stdout)) return failure('Missing stdout array');
  if (result.error || result.runtimeError || result.state?.__runtime_error || result.state?.__orch_error)
    return failure('Runtime reported an error');
  if (result.stepLimitHit) return failure('Runtime step limit was reached');
  if (!isDeepStrictEqual(result.stdout, test.stdout))
    return failure(`Output mismatch: expected ${JSON.stringify(test.stdout)}, received ${JSON.stringify(result.stdout)}`);
  if (test.exitCode !== undefined && result.globals?.CS_EXIT_CODE !== test.exitCode)
    return failure(`Exit code mismatch: expected ${test.exitCode}, received ${result.globals?.CS_EXIT_CODE}`);
  for (const [method, expected] of Object.entries(test.specializations || {})) {
    const actualTypes = Object.values(actual.procedures || {}).filter(proc => proc.name === method).map(proc => proc.typeArguments);
    const canonical = list => list.map(value => JSON.stringify(value)).sort();
    if (!isDeepStrictEqual(canonical(actualTypes), canonical(expected)))
      return failure(`Specialization mismatch for ${method}: ${JSON.stringify(actualTypes)}`);
  }
  return { status: 'pass' };
}
