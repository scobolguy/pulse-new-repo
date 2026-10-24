import { fail } from './parser.mjs';
import { VALUE_TYPES, resolveConsoleMember } from '../../dotnet/system-library.mjs';

const copy = state => ({ assigned: new Set(state.assigned), reachable: state.reachable });
function merge(states) {
  const live = states.filter(state => state.reachable);
  return {
    reachable: live.length > 0,
    assigned: new Set(live.length ? [...live[0].assigned].filter(slot => live.every(state => state.assigned.has(slot))) : [])
  };
}
function update(state, next) { state.assigned = next.assigned; state.reachable = next.reachable; }
const hasConstant = node => Object.hasOwn(node, 'constant');

export function analyze(program) {
  const methods = new Map(), classes = new Set();
  for (const owner of program.classes) {
    if (classes.has(owner.name)) fail(owner.token, `Duplicate class '${owner.name}'`);
    classes.add(owner.name);
    for (const method of owner.methods) {
      if (method.name === owner.token.value) fail(method.token, 'A method cannot have the same name as its containing class');
      const key = `${owner.name}.${method.name}`;
      if (methods.has(key)) fail(method.token, 'Method overloading is not supported; use distinct names');
      methods.set(key, method);
      method.key = key;
    }
  }
  const entries = [...methods.values()].filter(method => method.name === 'Main');
  if (entries.length !== 1) fail(program.classes[0]?.token || program.token, 'Exactly one static Main method is required');
  const entry = entries[0];
  if (entry.typeParams.length || entry.params.length || !['int', 'void'].includes(entry.returnType.name))
    fail(entry.token, 'Entry point must be static void Main() or static int Main()');

  for (const method of methods.values()) {
    const parameters = new Set();
    for (const token of method.typeParams) {
      if (VALUE_TYPES.has(token.value) || token.value === 'void') fail(token, 'A type parameter cannot use a built-in type name');
      if (parameters.has(token.value)) fail(token, `Duplicate type parameter '${token.value}'`);
      parameters.add(token.value);
    }
    const validateType = (type, allowVoid = false) => {
      if (!VALUE_TYPES.has(type.name) && !parameters.has(type.name) && !(allowVoid && type.name === 'void'))
        fail(type, `Unsupported or unknown type '${type.name}'`);
      return type.name;
    };
    validateType(method.returnType, true);
    method.params.forEach(parameter => validateType(parameter.type));
    let serial = 0;
    const scopes = [], loops = [];
    method.locals = [];
    function pushScope() { scopes.push({ names: new Map(), descendants: new Set() }); }
    function declare(token, type, isParameter = false) {
      if (parameters.has(token.value)) fail(token, 'A local or parameter cannot hide a type parameter');
      if (scopes.some(scope => scope.names.has(token.value)) || scopes.at(-1).descendants.has(token.value))
        fail(token, `Duplicate or shadowed local '${token.value}'`);
      const variable = { name: token.value, type, slot: `CS_V${serial++}` };
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
      return variable;
    }
    const requireType = (actual, expected, token) => {
      if (actual !== expected) fail(token, `Cannot use '${actual}' where '${expected}' is required`);
    };
    function foldedInt(node, value, unchecked) {
      if (!unchecked && (value < -2147483648n || value > 2147483647n)) fail(node.token, 'Constant Int32 expression overflows (use unchecked explicitly)');
      node.constant = Number(BigInt.asIntN(32, value));
    }
    function binary(node, left, right, unchecked) {
      const { op, token } = node;
      if (['&&', '||'].includes(op)) {
        requireType(left, 'bool', token); requireType(right, 'bool', token);
        return 'bool';
      }
      if (['==', '!='].includes(op)) {
        requireType(right, left, token);
        if (!VALUE_TYPES.has(left)) fail(token, 'Equality on unconstrained type parameters is not supported');
        if (hasConstant(node.left) && hasConstant(node.right))
          node.constant = op === '==' ? node.left.constant === node.right.constant : node.left.constant !== node.right.constant;
        return 'bool';
      }
      if (op === '+' && (left === 'string' || right === 'string')) {
        if (!VALUE_TYPES.has(left) || !VALUE_TYPES.has(right)) fail(token, 'String concatenation supports int, bool and string operands');
        return 'string';
      }
      requireType(left, 'int', token); requireType(right, 'int', token);
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
      }
      return 'int';
    }
    function expression(node, state, unchecked = false) {
      let type;
      switch (node.kind) {
        case 'literal':
          type = node.literalType;
          if (type === 'int') {
            const value = BigInt(node.value);
            if (value > 2147483647n) fail(node.token, 'Integer literal is outside the supported Int32 range');
            node.constant = Number(value);
          } else node.constant = node.value;
          break;
        case 'name': type = lookup(node, state).type; break;
        case 'unchecked': type = expression(node.value, state, true); if (hasConstant(node.value)) node.constant = node.value.constant; break;
        case 'unary': {
          if (node.op === '-' && node.value.kind === 'literal' && node.value.literalType === 'int' && BigInt(node.value.value) === 2147483648n) {
            node.constant = -2147483648; type = 'int'; break;
          }
          type = expression(node.value, state, unchecked);
          requireType(type, node.op === '!' ? 'bool' : 'int', node.token);
          if (hasConstant(node.value)) {
            if (node.op === '!') node.constant = !node.value.constant;
            else foldedInt(node, BigInt(node.value.constant) * (node.op === '-' ? -1n : 1n), unchecked);
          }
          break;
        }
        case 'binary': {
          const left = expression(node.left, state, unchecked);
          if (['&&', '||'].includes(node.op)) {
            const before = copy(state), after = copy(state);
            const right = expression(node.right, after, unchecked);
            type = binary(node, left, right, unchecked);
            const evaluatesRight = hasConstant(node.left) && (node.op === '&&' ? node.left.constant : !node.left.constant);
            update(state, hasConstant(node.left) ? evaluatesRight ? after : before : merge([before, after]));
            if (hasConstant(node.left) && (!evaluatesRight || hasConstant(node.right)))
              node.constant = evaluatesRight ? node.right.constant : node.left.constant;
          } else type = binary(node, left, expression(node.right, state, unchecked), unchecked);
          break;
        }
        case 'assign': {
          const variable = lookup(node.left, state, node.op !== '=');
          const right = expression(node.right, state, unchecked);
          if (node.op !== '=') {
            const operation = { ...node, op: node.op[0] };
            type = binary(operation, variable.type, right, unchecked);
          } else type = right;
          requireType(type, variable.type, node.token);
          state.assigned.add(variable.slot);
          type = variable.type;
          break;
        }
        case 'increment':
          type = lookup(node.value, state).type; requireType(type, 'int', node.token);
          break;
        case 'conditional': {
          requireType(expression(node.condition, state, unchecked), 'bool', node.token);
          const yes = copy(state), no = copy(state);
          type = expression(node.yes, yes, unchecked);
          requireType(expression(node.no, no, unchecked), type, node.token);
          if (type === 'void') fail(node.token, 'Conditional operands must have a value');
          update(state, hasConstant(node.condition) ? node.condition.constant ? yes : no : merge([yes, no]));
          break;
        }
        case 'call': {
          const consoleName = resolveConsoleMember(node.name, program.usingSystem);
          if (consoleName) {
            const allowed = consoleName.endsWith('WriteLine') ? [0, 1] : [1];
            if (node.typeArgs.length || !allowed.includes(node.args.length)) fail(node.token, `${consoleName} requires ${allowed.join(' or ')} argument(s), without type arguments`);
            for (const arg of node.args) {
              if (!VALUE_TYPES.has(expression(arg, state, unchecked))) fail(arg.token, 'Console supports int, bool and string values, not an unconstrained type parameter');
            }
            node.consoleName = consoleName; type = 'void'; break;
          }
          const target = methods.get(node.name.includes('.') ? node.name : `${method.owner}.${node.name}`)
            || methods.get(`${method.owner.slice(0, method.owner.lastIndexOf('.') + 1)}${node.name}`);
          if (!target) fail(node.token, `Unknown static method '${node.name}'`);
          if (target.owner !== method.owner && !target.modifiers.has('public') && !target.modifiers.has('internal'))
            fail(node.token, `Method '${target.key}' is inaccessible`);
          if (node.args.length !== target.params.length) fail(node.token, `Method '${node.name}' requires ${target.params.length} argument(s)`);
          const argumentTypes = node.args.map(arg => expression(arg, state, unchecked));
          if (argumentTypes.includes('void')) fail(node.token, 'A void invocation cannot be used as an argument');
          const bindings = new Map();
          if (node.typeArgs.length) {
            if (node.typeArgs.length !== target.typeParams.length) fail(node.token, `Method '${node.name}' requires ${target.typeParams.length} type argument(s)`);
            node.typeArgs.forEach((arg, i) => bindings.set(target.typeParams[i].value, validateType(arg)));
          } else {
            target.params.forEach((param, index) => {
              if (!target.typeParams.some(token => token.value === param.type.name)) return;
              const previous = bindings.get(param.type.name), actual = argumentTypes[index];
              if (previous && previous !== actual) fail(node.token, `Conflicting inferred types for '${param.type.name}'`);
              bindings.set(param.type.name, actual);
            });
          }
          node.genericTypes = target.typeParams.map(token => {
            const value = bindings.get(token.value);
            if (!value) fail(node.token, `Cannot infer type argument '${token.value}'; supply explicit type arguments`);
            return value;
          });
          target.params.forEach((param, index) =>
            requireType(argumentTypes[index], bindings.get(param.type.name) || param.type.name, node.args[index].token));
          node.method = target;
          type = bindings.get(target.returnType.name) || target.returnType.name;
          break;
        }
        default: fail(node.token, `Unsupported expression ${node.kind}`);
      }
      node.valueType = type;
      return type;
    }
    function statementExpression(node, state) {
      if (!['assign', 'increment', 'call'].includes(node.kind)) fail(node.token, 'Only assignment, increment/decrement and invocation expressions are permitted as statements');
      expression(node, state);
    }
    function embedded(node, state) {
      if (node.kind === 'declare') fail(node.token, 'A local declaration requires a block here');
      return statement(node, state);
    }
    function statement(node, state) {
      switch (node.kind) {
        case 'block':
          pushScope();
          for (const item of node.statements) statement(item, state);
          scopes.pop();
          break;
        case 'empty': break;
        case 'declare': {
          const type = validateType(node.type);
          for (const item of node.declarations) {
            item.variable = declare(item.token, type);
            if (item.value) {
              requireType(expression(item.value, state), type, item.token);
              state.assigned.add(item.variable.slot);
            }
          }
          break;
        }
        case 'expressions': node.values.forEach(value => statementExpression(value, state)); break;
        case 'return':
          if (method.returnType.name === 'void' && node.value) fail(node.token, 'A void method cannot return a value');
          if (method.returnType.name !== 'void' && !node.value) fail(node.token, 'A value is required by this return statement');
          if (node.value) requireType(expression(node.value, state), method.returnType.name, node.token);
          state.reachable = false;
          break;
        case 'if': {
          requireType(expression(node.condition, state), 'bool', node.condition.token);
          const yes = copy(state), no = copy(state);
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
    const state = { assigned: new Set(), reachable: true };
    for (const param of method.params) {
      param.variable = declare(param.token, param.type.name, true);
      state.assigned.add(param.variable.slot);
    }
    statement(method.body, state);
    if (state.reachable && method.returnType.name !== 'void') fail(method.token, 'Not all code paths return a value');
  }
  return { methods, entry };
}
