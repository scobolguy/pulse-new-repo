import { fail } from './source-diagnostics.mjs';
import { implicitConversion, widensInteger, isInteger } from './integer-types.mjs';

export function methodSignature(method) {
  const positions = new Map(method.typeParams.map((parameter, index) => [parameter.value, `!${index}`]));
  return `${method.key}\`${method.typeParams.length}(${method.params
    .map(parameter => positions.get(parameter.type.name) || parameter.type.name).join(',')})`;
}

function bindMethod(method, node, argumentTypes, explicitTypes) {
  const reject = (message, token = node.token) => ({ message, token });
  const vararg = method.params.at(-1)?.vararg;
  if ((!vararg && argumentTypes.length !== method.params.length)
      || (vararg && argumentTypes.length < method.params.length - 1))
    return reject(`Method '${node.name}' requires ${method.params.length} argument(s)`);
  const bindings = new Map();
  if (explicitTypes.length) {
    if (explicitTypes.length !== method.typeParams.length)
      return reject(`Method '${node.name}' requires ${method.typeParams.length} type argument(s)`);
    explicitTypes.forEach((type, index) => bindings.set(method.typeParams[index].value, type));
  } else {
    for (const [index, parameter] of method.params.entries()) {
      if (!method.typeParams.some(token => token.value === parameter.type.name)) continue;
      const actual = argumentTypes[vararg && index === method.params.length - 1 ? argumentTypes.length - 1 : index];
      const previous = bindings.get(parameter.type.name);
      if (previous && previous !== actual)
        return reject(`Conflicting inferred types for '${parameter.type.name}'`);
      bindings.set(parameter.type.name, actual);
    }
  }
  const genericTypes = [];
  for (const parameter of method.typeParams) {
    const type = bindings.get(parameter.value);
    if (!type) return reject(`Cannot infer type argument '${parameter.value}'; supply explicit type arguments`);
    genericTypes.push(type);
  }
  const parameterTypes = [];
  const parameterNullable = [];
  for (const [index, parameter] of method.params.entries()) {
    const expected = bindings.get(parameter.type.name) || parameter.type.name;
    parameterTypes.push(expected);
    parameterNullable.push(parameter.type.nullable === true);
    const actualIndex = vararg && index === method.params.length - 1 ? argumentTypes.length - 1 : index;
    const actual = argumentTypes[actualIndex];
    const nullableReference = actual === 'null' && (parameter.type.nullable === true
      || !['sbyte', 'byte', 'short', 'ushort', 'int', 'bool', 'string', 'void'].includes(expected));
    if (!nullableReference
        && !implicitConversion(actual, expected, node.args[actualIndex], node.token.sourceLanguage))
      return reject(`Cannot use '${argumentTypes[actualIndex]}' where '${expected}' is required`, node.args[actualIndex].token);
  }
  return { method, genericTypes, parameterTypes, parameterNullable,
    returnType: bindings.get(method.returnType.name) || method.returnType.name,
    returnNullable: method.returnType.nullable === true };
}

function betterMember(left, right, sourceLanguage, argumentTypes) {
  const a = left.method, b = right.method;
  let betterConversion = false;
  for (let index = 0; index < argumentTypes.length; index++) {
    const x = left.parameterTypes[index], y = right.parameterTypes[index], actual = argumentTypes[index];
    if (x === y) continue;
    const vbOrder = ['byte', 'sbyte', 'short', 'ushort', 'int'];
    const preferred = sourceLanguage === 'vbish'
      ? isInteger(x) && isInteger(y) && vbOrder.indexOf(x) < vbOrder.indexOf(y)
      : x === 'sbyte' && ['byte', 'ushort'].includes(y) || x === 'short' && y === 'ushort';
    if (actual === y || actual !== x && !widensInteger(x, y) && !preferred) return false;
    betterConversion = true;
  }
  if (betterConversion) return true;
  if (sourceLanguage !== 'vbish' && !a.typeParams.length && b.typeParams.length) return true;
  if (sourceLanguage !== 'vbish' && a.typeParams.length && !b.typeParams.length) return false;
  let moreSpecific = false;
  for (let index = 0; index < a.params.length; index++) {
    const aGeneric = a.typeParams.some(token => token.value === a.params[index].type.name);
    const bGeneric = b.typeParams.some(token => token.value === b.params[index].type.name);
    if (aGeneric && !bGeneric) return false;
    if (!aGeneric && bGeneric) moreSpecific = true;
  }
  return moreSpecific;
}

export function resolveMethod(group, node, argumentTypes, explicitTypes, caller) {
  const accessible = group.filter(method => method.owner === caller.owner
    || method.modifiers.has('public') || method.modifiers.has('internal'));
  if (!accessible.length) fail(node.token, `Method '${node.name}' is inaccessible`);
  const results = accessible.map(method => bindMethod(method, node, argumentTypes, explicitTypes));
  const applicable = results.filter(result => result.method);
  if (!applicable.length) {
    if (results.length === 1) fail(results[0].token, results[0].message);
    fail(node.token, `No applicable overload for '${node.name}' with argument types (${argumentTypes.join(', ')}): ${
      results.map(result => result.message).join('; ')}`);
  }
  const best = applicable.filter(candidate => applicable.every(other =>
    candidate === other || betterMember(candidate, other, caller.token.sourceLanguage, argumentTypes)));
  if (best.length !== 1)
    fail(node.token, `Ambiguous invocation of '${node.name}': ${applicable.map(candidate => candidate.method.signature).join('; ')}`);
  return best[0];
}
