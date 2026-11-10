import { fail } from './source-diagnostics.mjs';
import { VALUE_TYPES, resolveConsoleMember } from './system-library.mjs';
import { methodSignature, resolveMethod } from './method-resolution.mjs';
import { scalarConversion, convertScalarConstant } from './scalar-conversions.mjs';
import { isInteger, fitsInteger, implicitConversion, integerResult, widensInteger } from './integer-types.mjs';

const copy = state => ({
  assigned: new Set(state.assigned), possiblyAssigned: new Set(state.possiblyAssigned),
  nonNull: new Set(state.nonNull), reachable: state.reachable
});
function merge(states) {
  const live = states.filter(state => state.reachable);
  return {
    reachable: live.length > 0,
    assigned: new Set(live.length ? [...live[0].assigned].filter(slot => live.every(state => state.assigned.has(slot))) : []),
    possiblyAssigned: new Set(live.flatMap(state => [...state.possiblyAssigned])),
    nonNull: new Set(live.length ? [...live[0].nonNull].filter(slot => live.every(state => state.nonNull.has(slot))) : [])
  };
}
function update(state, next) {
  state.assigned = next.assigned;
  state.possiblyAssigned = next.possiblyAssigned;
  state.nonNull = next.nonNull;
  state.reachable = next.reachable;
}
const hasConstant = node => Object.hasOwn(node, 'constant');

export function analyze(program, { imports = [], checkedArithmetic = false, service = null } = {}) {
  const methods = new Map(), groups = new Map(), classes = new Set();
  const classNames = new Set(program.classes.map(owner => owner.name));
  const groupKey = (name, token) => token.sourceLanguage === 'vbish' ? name.toLowerCase() : name;
  function register(method) {
    method.signature = methodSignature(method);
    if (methods.has(method.signature)) fail(method.token, `Duplicate method signature '${method.signature}'`);
    methods.set(method.signature, method);
    const key = groupKey(method.key, method.token);
    const group = groups.get(key) || [];
    group.push(method);
    groups.set(key, group);
  }
  for (const owner of program.classes) {
    if (classes.has(owner.name)) fail(owner.token, `Duplicate class '${owner.name}'`);
    classes.add(owner.name);
    for (const method of owner.methods) {
      if (method.name === owner.token.value) fail(method.token, 'A method cannot have the same name as its containing class');
      const key = `${owner.name}.${method.name}`;
      method.key = key;
      register(method);
    }
  }
  const mainMethods = service
    ? [...methods.values()].filter(method => service.handlers.includes(method.name))
    : [...methods.values()].filter(method => method.name === 'Main');
  const entries = mainMethods.filter(method => !method.typeParams.length && !method.params.length
    && (service?.dispatchEndpoints ? method.returnType.name === 'string'
      : ['int', 'void'].includes(method.returnType.name)));
  if (service) {
    if (entries.length === 0) fail(program.classes[0]?.token || program.token, 'A service must declare at least one endpoint handler');
    if (entries.some(method => method.params.length > 0)) {
      fail(entries.find(method => method.params.length > 0).token, 'Service handlers must have no machine parameters after lowering');
    }
  } else {
    if (!entries.length && mainMethods.length) fail(mainMethods[0].token, 'Entry point must be static void Main() or static int Main()');
    if (entries.length !== 1) fail(program.classes[0]?.token || program.token, 'Exactly one static Main method is required');
  }
  const entry = entries[0];

  for (const item of imports) {
    if (groups.has(groupKey(item.key, entry.token))) fail(entry.token, `Imported method '${item.key}' conflicts with a source declaration`);
    register({
      key: item.key, name: item.key.split('.').at(-1), owner: item.key.slice(0, item.key.lastIndexOf('.')),
      token: entry.token, external: item.label, typeParams: [], modifiers: new Set(['public', 'static']),
      params: item.parameterTypes.map(type => ({ type: { name: type } })), returnType: { name: item.returnType }
    });
  }
  for (const method of methods.values()) {
    if (method.external) continue;
    const parameters = new Set();
    for (const token of method.typeParams) {
      if (VALUE_TYPES.has(token.value) || token.value === 'void') fail(token, 'A type parameter cannot use a built-in type name');
      if (parameters.has(token.value)) fail(token, `Duplicate type parameter '${token.value}'`);
      parameters.add(token.value);
    }
    const validateType = (type, allowVoid = false) => {
      if (!VALUE_TYPES.has(type.name) && !classNames.has(type.name) && !parameters.has(type.name) && !(allowVoid && type.name === 'void'))
        fail(type, `Unsupported or unknown type '${type.name}'`);
      return type.name;
    };
    validateType(method.returnType, true);
    method.params.forEach(parameter => validateType(parameter.type));
    let serial = 0, overflowMode = null;
    const scopes = [], loops = [], declarationLoopDepth = new WeakMap();
    method.locals = [];
    function pushScope() { scopes.push({ names: new Map(), descendants: new Set() }); }
    function declare(token, type, isParameter = false, nullable = false) {
      if (parameters.has(token.value)) fail(token, 'A local or parameter cannot hide a type parameter');
      if (scopes.some(scope => scope.names.has(token.value)) || scopes.at(-1).descendants.has(token.value))
        fail(token, `Duplicate or shadowed local '${token.value}'`);
      const variable = { name: token.value, type, nullable, slot: `CS_V${serial++}` };
      declarationLoopDepth.set(variable, loops.length);
      scopes.at(-1).names.set(token.value, variable);
      for (const scope of scopes.slice(0, -1)) scope.descendants.add(token.value);
      if (!isParameter) method.locals.push(variable);
      return variable;
    }
    function lookup(node, state, read = true) {
      if (node.kind !== 'name') fail(node.token, 'Assignment requires a local variable');
      const variable = [...scopes].reverse().map(scope => scope.names.get(node.name)).find(Boolean);
      if (!variable) fail(node.token, `Unknown local '${node.name}'`);
      if (read && state.reachable && !state.assigned.has(variable.slot)) fail(node.token, `Use of unassigned local '${node.name}'`);
      node.variable = variable;
      node.valueType = variable.type;
      node.nullable = variable.nullable === true && !state.nonNull.has(variable.slot);
      return variable;
    }
    const requireType = (actual, expected, token) => {
      if (actual !== expected) fail(token, `Cannot use '${actual}' where '${expected}' is required`);
    };
    function coerce(node, expected, allowNull = false) {
      if (node.valueType === 'nothing') {
        node.valueType = expected;
        return node;
      }
      if (node.valueType === 'null' && allowNull) {
        node.valueType = expected;
        return node;
      }
      if (node.valueType === 'null' && (!VALUE_TYPES.has(expected) || classNames.has(expected) || parameters.has(expected))) {
        node.valueType = expected;
        return node;
      }
      if (!implicitConversion(node.valueType, expected, node, method.token.sourceLanguage))
        fail(node.token, `Cannot use '${node.valueType}' where '${expected}' is required`);
      if (node.valueType === expected) return node;
      return {
        kind: 'convert', conversion: 'integer', value: node, targetType: expected, valueType: expected,
        checkedArithmetic: true, token: node.token,
        ...(hasConstant(node) ? { constant: node.constant } : {})
      };
    }
    function foldedInt(node, value, unchecked) {
      if (!unchecked && (value < -2147483648n || value > 2147483647n)) fail(node.token, 'Constant Int32 expression overflows (use unchecked explicitly)');
      node.constant = Number(BigInt.asIntN(32, value));
    }
    function binary(node, left, right, unchecked) {
      const { op, token } = node;
      if (op === '..' || op === '..<') {
        requireType(left, 'int', token);
        requireType(right, 'int', token);
        return 'void';
      }
      if (op === '?:') {
        if (left === 'null') return right;
        if (right === 'null') return left;
        requireType(right, left, token);
        return left;
      }
      if (['and', 'or', 'xor'].includes(op)) {
        requireType(left, 'bool', token); requireType(right, 'bool', token);
        return 'bool';
      }
      if (op === 'concat') {
        if (!VALUE_TYPES.has(left) || !VALUE_TYPES.has(right)) fail(token, 'Concatenation requires scalar values');
        return 'string';
      }
      if (['&&', '||'].includes(op)) {
        requireType(left, 'bool', token); requireType(right, 'bool', token);
        return 'bool';
      }
      if (['==', '!='].includes(op)) {
        if (left === 'null' && right === 'null') {
          node.constant = op === '==';
          return 'bool';
        }
        if (right === 'null' && node.left.nullable || left === 'null' && node.right.nullable)
          return 'bool';
        if (node.left.nullable || node.right.nullable)
          fail(token, 'Nullable value requires a null check before comparison');
        if (right === 'null' && (classNames.has(left) || parameters.has(left)) ||
            left === 'null' && (classNames.has(right) || parameters.has(right))) return 'bool';
        if (isInteger(left) && isInteger(right)) {
          if (method.token.sourceLanguage === 'kotlin' && left !== right)
            fail(token, `Kotlin equality requires matching integer types, found '${left}' and '${right}'`);
          node.operationType = integerResult(left, right, token.sourceLanguage);
        } else requireType(right, left, token);
        if (!VALUE_TYPES.has(left) && !(method.token.sourceLanguage === 'kotlin' && parameters.has(left)))
          fail(token, 'Equality on unconstrained type parameters is not supported');
        if (hasConstant(node.left) && hasConstant(node.right))
          node.constant = op === '==' ? node.left.constant === node.right.constant : node.left.constant !== node.right.constant;
        return 'bool';
      }
      if (node.left.nullable || node.right.nullable)
        fail(token, 'Nullable value requires a null check before operation');
      if (op === '+' && (left === 'string' || right === 'string')) {
        if (token.sourceLanguage === 'vbish' && left !== right) fail(token, 'Mixed String/numeric addition is not supported; use & for concatenation');
        if (token.sourceLanguage === 'kotlin' && parameters.has(left) && right === 'string')
          fail(token, 'An unconstrained type parameter cannot be the receiver of string concatenation');
        const printable = type => VALUE_TYPES.has(type)
          || method.token.sourceLanguage === 'kotlin' && parameters.has(type);
        if (!printable(left) || !printable(right)) fail(token, 'String concatenation supports int, bool and string operands');
        return 'string';
      }
      if (!['+', '-', '*', '/', '%', '<', '<=', '>', '>='].includes(op))
        fail(token, `Unsupported binary operator '${op}'`);
      if (!isInteger(left)) requireType(left, 'int', token);
      if (!isInteger(right)) requireType(right, 'int', token);
      const result = integerResult(left, right, token.sourceLanguage);
      node.operationType = result;
      if (['<', '<=', '>', '>='].includes(op)) {
        if (hasConstant(node.left) && hasConstant(node.right)) {
          const a = node.left.constant, b = node.right.constant;
          node.constant = op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : a >= b;
        }
        return 'bool';
      }
      if (hasConstant(node.left) && hasConstant(node.right)) {
        const a = BigInt(node.left.constant), b = BigInt(node.right.constant);
        if ((op === '/' || op === '%') && b === 0n) fail(token, 'Constant division by zero');
        const value = op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : op === '/' ? a / b : a % b;
        foldedInt(node, value, unchecked);
        if (result !== 'int' && !fitsInteger(node.constant, result))
          fail(token, `Constant ${result} expression overflows`);
      }
      return result;
    }
    function expression(node, state, mode = overflowMode) {
      const unchecked = mode === false || method.token.sourceLanguage === 'kotlin' && mode !== true;
      node.checkedArithmetic = mode ?? checkedArithmetic;
      let type;
      switch (node.kind) {
        case 'literal':
          type = node.literalType;
          if (isInteger(type)) {
            const value = BigInt(node.value);
            if (value > 2147483647n) fail(node.token, 'Integer literal is outside the supported Int32 range');
            node.constant = Number(value);
          } else node.constant = node.value;
          break;
        case 'object-value':
          type = node.typeName;
          node.constant = 1;
          break;
        case 'field-get':
          if (!method.instance) fail(node.token, 'Instance field access requires an instance method');
          type = node.type;
          break;
        case 'field-set':
          if (!method.instance) fail(node.token, 'Instance field access requires an instance method');
          expression(node.value, state, mode);
          node.value = coerce(node.value, node.type);
          type = 'void';
          break;
        case 'array-new':
          requireType(expression(node.length, state, mode), 'int', node.token);
          type = node.arrayType;
          break;
        case 'index-get':
          const arrayType = expression(node.receiver, state, mode);
          if (!arrayType?.endsWith('-array'))
            fail(node.token, 'Property access, indexing, and null assertions are not supported by the P-code subset');
          requireType(expression(node.index, state, mode), 'int', node.token);
          type = arrayType === 'bool-array' ? 'bool' : arrayType === 'byte-array' ? 'sbyte'
            : arrayType === 'short-array' ? 'short' : 'int';
          break;
        case 'property': {
          const receiverType = expression(node.receiver, state, mode);
          if (receiverType === 'int-array' && node.name === 'size') {
            node.arraySize = true;
            type = 'int';
            break;
          }
          if (!classNames.has(receiverType)) fail(node.token, `${node.name} requires a function call`);
          const getterName = `${receiverType}.get${node.name[0].toUpperCase()}${node.name.slice(1)}`;
          const group = groups.get(groupKey(getterName, method.token));
          if (!group || !group.some(candidate => candidate.instance))
            fail(node.token, `Property '${node.name}' is not available on '${receiverType}'`);
          const selected = resolveMethod(group, { ...node, name: getterName, args: [] },
            [receiverType], [], method);
          node.method = selected.method;
          node.genericTypes = selected.genericTypes;
          node.valueType = selected.returnType;
          node.nullable = node.safe || selected.returnNullable;
          type = selected.returnType;
          break;
        }
        case 'name': type = lookup(node, state).type; break;
        case 'string-length':
          requireType(expression(node.value, state, mode), 'string', node.token);
          if (node.value.nullable) fail(node.token, 'Nullable string requires a non-null assertion before length access');
          type = 'int';
          break;
        case 'scalar-string': {
          const sourceType = expression(node.value, state, mode);
          if (!VALUE_TYPES.has(sourceType) && !(method.token.sourceLanguage === 'kotlin' && parameters.has(sourceType)))
            fail(node.token, 'String conversion requires a scalar value');
          type = 'string';
          break;
        }
        case 'range-test':
          for (const operand of [node.start, node.end, node.value])
            requireType(expression(operand, state, mode), 'int', operand.token);
          type = 'bool';
          break;
        case 'overflow':
          type = expression(node.value, state, node.checked);
          if (hasConstant(node.value)) node.constant = node.value.constant;
          break;
        case 'not-null':
          type = expression(node.value, state, mode);
          if (!node.value.nullable && type !== 'null' && (VALUE_TYPES.has(type) || type === 'void'))
            fail(node.token, 'Non-null assertion requires a nullable reference');
          if (type === 'void') fail(node.token, 'A Unit value cannot be null-asserted');
          break;
        case 'throw':
          expression(node.value, state, mode);
          type = 'nothing';
          break;
        case 'convert':
          node.conversion = scalarConversion(expression(node.value, state, mode), node.targetType, node.token);
          type = node.targetType;
          if (hasConstant(node.value)) {
            if (node.conversion === 'integer' && !unchecked && !fitsInteger(node.value.constant, type))
              fail(node.token, `Constant ${type} conversion overflows`);
            node.constant = convertScalarConstant(node.value.constant, node.conversion, type, !unchecked);
          }
          break;
        case 'unary': {
          if (node.op === '-' && node.value.kind === 'literal' && node.value.literalType === 'int' && BigInt(node.value.value) === 2147483648n) {
            node.constant = -2147483648; type = 'int'; break;
          }
          type = expression(node.value, state, mode);
          if (node.op === '!') requireType(type, 'bool', node.token);
          else {
            if (!isInteger(type)) requireType(type, 'int', node.token);
            type = method.token.sourceLanguage !== 'vbish' ? 'int'
              : node.op === '-' && type === 'byte' ? 'short'
                : node.op === '-' && type === 'ushort' ? 'int' : type;
          }
          if (hasConstant(node.value)) {
            if (node.op === '!') node.constant = !node.value.constant;
            else foldedInt(node, BigInt(node.value.constant) * (node.op === '-' ? -1n : 1n), unchecked);
            if (isInteger(type) && !fitsInteger(node.constant, type))
              fail(node.token, `Constant ${type} expression overflows`);
          }
          break;
        }
        case 'binary': {
          const left = expression(node.left, state, mode);
          if (node.op === '?:') {
            const fallback = copy(state);
            const right = expression(node.right, fallback, mode);
            type = binary(node, left, right, unchecked);
            update(state, hasConstant(node.left) && node.left.valueType === 'null' ? fallback : merge([state, fallback]));
          } else if (['&&', '||'].includes(node.op)) {
            const before = copy(state), after = copy(state);
            const right = expression(node.right, after, mode);
            type = binary(node, left, right, unchecked);
            const evaluatesRight = hasConstant(node.left) && (node.op === '&&' ? node.left.constant : !node.left.constant);
            update(state, hasConstant(node.left) ? evaluatesRight ? after : before : merge([before, after]));
            if (hasConstant(node.left) && (!evaluatesRight || hasConstant(node.right)))
              node.constant = evaluatesRight ? node.right.constant : node.left.constant;
          } else type = binary(node, left, expression(node.right, state, mode), unchecked);
          break;
        }
        case 'assign': {
          if (node.left.kind === 'index-get') {
            const arrayType = expression(node.left.receiver, state, mode);
            if (!arrayType?.endsWith('-array'))
              fail(node.token, 'Property access, indexing, and null assertions are not supported by the P-code subset');
            requireType(expression(node.left.index, state, mode), 'int', node.token);
            const elementType = arrayType === 'bool-array' ? 'bool' : arrayType === 'byte-array' ? 'sbyte'
              : arrayType === 'short-array' ? 'short' : 'int';
            const right = expression(node.right, state, mode);
            if (node.op !== '=') {
              const operation = { ...node, op: node.op[0], left: { kind: 'index-get', token: node.left.token,
                receiver: node.left.receiver, index: node.left.index, valueType: elementType } };
              type = binary(operation, elementType, right, node.checkedArithmetic);
              node.operationType = operation.operationType;
              if (isInteger(type) && isInteger(elementType)) node.assignmentConversion = elementType;
            } else type = right;
            if (type !== elementType && !(isInteger(type) && isInteger(elementType)))
              requireType(type, elementType, node.token);
            type = elementType;
            node.left.valueType = elementType;
            node.right = coerce(node.right, elementType);
            break;
          }
          const variable = lookup(node.left, state, node.op !== '=');
          if (method.token.sourceLanguage === 'kotlin' && variable.mutable === false
              && (state.possiblyAssigned.has(variable.slot) || loops.length > declarationLoopDepth.get(variable)))
            fail(node.token, `Val '${variable.name}' cannot be reassigned`);
          const right = expression(node.right, state, mode);
          if (node.op !== '=') {
            const operation = { ...node, op: node.op[0] };
            type = binary(operation, variable.type, right, unchecked);
            node.operationType = operation.operationType;
            if (method.token.sourceLanguage === 'vbish') requireType(type, variable.type, node.token);
            if (isInteger(type) && isInteger(variable.type)) node.assignmentConversion = variable.type;
            else requireType(type, variable.type, node.token);
          } else {
            node.right = coerce(node.right, variable.type, variable.nullable);
            type = variable.type;
          }
          state.assigned.add(variable.slot);
          state.possiblyAssigned.add(variable.slot);
          if (variable.nullable) {
            if (node.right.valueType === 'null') state.nonNull.delete(variable.slot);
            else if (!node.right.nullable) state.nonNull.add(variable.slot);
            else state.nonNull.delete(variable.slot);
          }
          type = variable.type;
          break;
        }
        case 'increment':
          {
            const variable = lookup(node.value, state);
            if (method.token.sourceLanguage === 'kotlin' && variable.mutable === false && !node.compilerGenerated)
              fail(node.token, `Val '${variable.name}' cannot be incremented`);
            type = variable.type;
          }
          if (!isInteger(type)) requireType(type, 'int', node.token);
          break;
        case 'conditional': {
          requireType(expression(node.condition, state, mode), 'bool', node.token);
          const yes = copy(state), no = copy(state);
          type = expression(node.yes, yes, mode);
          const noType = expression(node.no, no, mode);
          if (type !== noType && isInteger(type) && isInteger(noType)) {
            const yesToNo = widensInteger(type, noType);
            const noToYes = widensInteger(noType, type);
            if (yesToNo === noToYes) fail(node.token, 'Conditional integer operands have no unique common type');
            if (yesToNo) type = noType;
            node.yes = coerce(node.yes, type);
            node.no = coerce(node.no, type);
          } else if (type === 'nothing') type = noType;
          else if (noType !== 'nothing') requireType(noType, type, node.token);
          if (type === 'void' || type === 'nothing') fail(node.token, 'Conditional operands must have a value');
          update(state, hasConstant(node.condition) ? node.condition.constant ? yes : no : merge([yes, no]));
          break;
        }
        case 'call': {
          let receiverType = null;
          if (node.receiver) {
            receiverType = expression(node.receiver, state, mode);
            if (!classNames.has(receiverType))
              fail(node.token, `Receiver type '${receiverType}' has no stateless method dispatch`);
            node.name = `${receiverType}.${node.name}`;
          }
          const consoleName = resolveConsoleMember(node.name, program.usingSystem);
          if (consoleName) {
            const allowed = consoleName.endsWith('WriteLine') ? [0, 1] : [1];
            if (node.typeArgs.length || !allowed.includes(node.args.length)) fail(node.token, `${consoleName} requires ${allowed.join(' or ')} argument(s), without type arguments`);
            for (const arg of node.args) {
              const type = expression(arg, state, mode);
              if (!VALUE_TYPES.has(type) && !(method.token.sourceLanguage === 'kotlin' && parameters.has(type)))
                fail(arg.token, 'Console supports int, bool and string values, not an unconstrained type parameter');
            }
            node.consoleName = consoleName; type = 'void'; break;
          }
          const group = groups.get(groupKey(node.name.includes('.') ? node.name : `${method.owner}.${node.name}`, method.token))
            || groups.get(groupKey(`${method.owner.slice(0, method.owner.lastIndexOf('.') + 1)}${node.name}`, method.token));
          if (!group) fail(node.token, `Unknown static method '${node.name}'`);
          const instanceDispatch = Boolean(node.receiver && group.some(candidate => candidate.instance));
          const argumentTypes = [
            ...(instanceDispatch ? [receiverType] : []),
            ...node.args.map(arg => expression(arg, state, mode))
          ];
          if (argumentTypes.includes('void')) fail(node.token, 'A void invocation cannot be used as an argument');
          const selected = resolveMethod(group, node, argumentTypes, node.typeArgs.map(arg => validateType(arg)), method);
          node.genericTypes = selected.genericTypes;
          node.method = selected.method;
          // With instance dispatch, parameterTypes[0] belongs to the receiver,
          // which is not part of node.args.
          const parameterOffset = instanceDispatch ? 1 : 0;
          node.args = node.args.map((arg, index) =>
            coerce(arg, selected.parameterTypes[index + parameterOffset], selected.parameterNullable[index + parameterOffset]));
          type = selected.returnType;
          node.nullable = selected.returnNullable;
          if (node.safe && type !== 'void') node.nullable = true;
          break;
        }
        default: fail(node.token, `Unsupported expression ${node.kind}`);
      }
      node.valueType = type;
      return type;
    }
    function statementExpression(node, state) {
      if (method.token.sourceLanguage !== 'kotlin' && !['assign', 'increment', 'call'].includes(node.kind))
        fail(node.token, 'Only assignment, increment/decrement and invocation expressions are permitted as statements');
      expression(node, state);
    }
    function embedded(node, state) {
      if (node.kind === 'declare') fail(node.token, 'A local declaration requires a block here');
      return statement(node, state);
    }
    function statement(node, state) {
      switch (node.kind) {
        case 'overflow': {
          const previous = overflowMode;
          overflowMode = node.checked;
          statement(node.body, state);
          overflowMode = previous;
          break;
        }
        case 'block':
          pushScope();
          for (const item of node.statements) statement(item, state);
          scopes.pop();
          break;
        case 'empty': break;
        case 'declarations':
          for (const declaration of node.declarations) statement(declaration, state);
          break;
        case 'declare': {
          const declaredType = node.infer ? null : validateType(node.type);
          for (const item of node.declarations) {
            let type = declaredType;
            if (node.infer) {
              if (!item.value) fail(item.token, 'A Kotlin local without an initializer requires an explicit type');
              type = expression(item.value, state);
              if (type === 'void') fail(item.token, 'Cannot infer a local variable type from a Unit expression');
            }
            item.variable = declare(item.token, type, false, node.type?.nullable === true);
            item.variable.mutable = item.mutable !== false;
            if (item.value) {
              if (!node.infer) {
                expression(item.value, state);
                item.value = coerce(item.value, type, node.type?.nullable === true);
              }
              state.assigned.add(item.variable.slot);
              state.possiblyAssigned.add(item.variable.slot);
            }
          }
          break;
        }
        case 'expressions':
          node.values.forEach(value => {
            statementExpression(value, state);
            if (value.kind === 'throw') state.reachable = false;
          });
          break;
        case 'try': {
          const protectedState = copy(state);
          statement(node.body, protectedState);
          const branches = [protectedState];
          for (const handler of node.catches) {
            const handlerState = copy(state);
            statement(handler.body, handlerState);
            branches.push(handlerState);
          }
          if (node.finallyBody) statement(node.finallyBody, protectedState);
          update(state, merge(branches));
          break;
        }
        case 'return':
          if (node.value?.kind === 'throw') {
            expression(node.value, state);
            state.reachable = false;
            break;
          }
          if (method.returnType.name === 'void' && node.value) fail(node.token, 'A void method cannot return a value');
          if (method.returnType.name !== 'void' && !node.value) fail(node.token, 'A value is required by this return statement');
          if (node.value) {
            expression(node.value, state);
            node.value = coerce(node.value, method.returnType.name, method.returnType.nullable === true);
          }
          state.reachable = false;
          break;
        case 'if': {
          requireType(expression(node.condition, state), 'bool', node.condition.token);
          const yes = copy(state), no = copy(state);
          const condition = node.condition;
          if (condition.kind === 'binary' && ['==', '!='].includes(condition.op)) {
            const reference = condition.left.kind === 'name' && condition.right.valueType === 'null'
              ? condition.left : condition.right.kind === 'name' && condition.left.valueType === 'null'
                ? condition.right : null;
            if (reference?.variable?.nullable) {
              const nonNullOnYes = condition.op === '!=';
              const yesState = nonNullOnYes ? yes : no;
              const nullState = nonNullOnYes ? no : yes;
              yesState.nonNull.add(reference.variable.slot);
              nullState.nonNull.delete(reference.variable.slot);
            }
          }
          if (hasConstant(node.condition)) {
            yes.reachable &&= node.condition.constant;
            no.reachable &&= !node.condition.constant;
          }
          embedded(node.then, yes);
          if (node.otherwise) embedded(node.otherwise, no);
          update(state, hasConstant(node.condition) ? node.condition.constant ? yes : no : merge([yes, no]));
          break;
        }
        case 'break': case 'continue':
          if (!loops.length) fail(node.token, `'${node.kind}' requires an enclosing loop`);
          loops.at(-1)[node.kind].push(copy(state));
          state.reachable = false;
          break;
        case 'while': case 'for': case 'do': {
          pushScope();
          if (node.init) statement(node.init, state);
          const loop = { break: [], continue: [] };
          loops.push(loop);
          if (node.kind !== 'do' && node.condition) requireType(expression(node.condition, state), 'bool', node.condition.token);
          const before = copy(state), body = copy(state);
          if (node.kind !== 'do' && node.condition && hasConstant(node.condition) && node.condition.constant === false)
            body.reachable = false;
          embedded(node.body, body);
          const tail = merge([body, ...loop.continue]);
          if (node.kind === 'for') node.increment.forEach(value => statementExpression(value, tail));
          if (node.kind === 'do') requireType(expression(node.condition, tail), 'bool', node.condition.token);
          loops.pop();
          const conditionAlwaysTrue = !node.condition || hasConstant(node.condition) && node.condition.constant === true;
          update(state, merge([...loop.break, ...(!conditionAlwaysTrue ? [node.kind === 'do' ? tail : before] : [])]));
          scopes.pop();
          break;
        }
        default: fail(node.token, `Unsupported statement ${node.kind}`);
      }
    }
    pushScope();
    const state = { assigned: new Set(), possiblyAssigned: new Set(), nonNull: new Set(), reachable: true };
    for (const param of method.params) {
      param.variable = declare(param.token, param.type.name, true, param.type.nullable === true);
      if (method.token.sourceLanguage === 'kotlin') param.variable.mutable = false;
      state.assigned.add(param.variable.slot);
      state.possiblyAssigned.add(param.variable.slot);
    }
    statement(method.body, state);
    for (const field of method.fieldInitializers || []) {
      expression(field.value, state);
      field.value = coerce(field.value, field.type);
    }
    if (state.reachable && method.returnType.name !== 'void') fail(method.token, 'Not all code paths return a value');
  }
  return { methods, entry };
}
