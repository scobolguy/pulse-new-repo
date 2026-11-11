import path from 'node:path';
import { fail } from './source-diagnostics.mjs';
import { analyze } from './scalar-semantics.mjs';
import { SYSTEM_LIBRARY } from './system-library.mjs';
import { isInteger } from './integer-types.mjs';
import { PMACHINE_ABI } from '../../virtualMachines/esp32/pmachines/shared/p-machine-abi.mjs';

export function compileScalarToPcode(program, source, {
  fileName, sourceLanguage, checkedArithmetic = false, imports = [], target = 'js', service = null
} = {}) {
  if (!['js', 'esp32'].includes(target)) throw new TypeError(`Unsupported scalar target '${target}'`);
  const { methods, entry } = analyze(program, { imports, checkedArithmetic, service });
  const sourceLines = source.split(/\r?\n/);
  const lines = [], sourceMap = {}, procedures = {}, instances = new Map(), pending = [];
  let address = 0, labelSerial = 0, context;
  const fresh = prefix => `CS_${prefix}_${labelSerial++}`;
  const emit = (instruction, token) => {
    lines.push(instruction);
    if (!instruction.endsWith(':')) {
      sourceMap[address++] = {
        sourceFile: fileName, sourceLanguage, sourceLine: token.line,
        sourceColumn: token.column, sourceText: sourceLines[token.line - 1] || '', instruction
      };
    }
  };
  function instantiate(method, typeArgs) {
    if (method.external) return { label: method.external };
    const identity = `${method.signature}<${typeArgs.join(',')}>`;
    if (instances.has(identity)) return instances.get(identity);
    if (instances.size >= 128) fail(method.token, 'Generic/method specialization capacity exceeded (128 procedures)');
    const label = fresh('METHOD');
    const bindings = new Map(method.typeParams.map((param, index) => [param.value, typeArgs[index]]));
    const instance = { method, typeArgs, bindings, label };
    instances.set(identity, instance);
    pending.push(instance);
    return instance;
  }
  const concrete = type => context.bindings.get(type) || type;
  function temporary() {
    const slot = `CS_TMP${context.temporary++}`;
    context.metadata.locals.push(slot);
    return slot;
  }
  function asString(node) {
    expression(node);
    const type = concrete(node.valueType);
    if (type === 'bool') {
      const no = fresh('BOOL_FALSE'), end = fresh('BOOL_END');
      const [trueText, falseText] = sourceLanguage === 'kotlin' ? ['true', 'false'] : ['True', 'False'];
      emit(`JZ ${no}`, node.token);
      emit(`PUSH_STR ${JSON.stringify(trueText)}`, node.token); emit(`JMP ${end}`, node.token);
      emit(`${no}:`, node.token); emit(`PUSH_STR ${JSON.stringify(falseText)}`, node.token); emit(`${end}:`, node.token);
    } else if (isInteger(type)) {
      emit('CALL_EXT system.int32.tostring 1', node.token);
    }
  }
  function integerConversion(type, checked, token) {
    if (type === 'int') return;
    emit(`PUSH_STR ${JSON.stringify(type)}`, token);
    emit(`PUSH_INT ${Number(checked)}`, token);
    emit('CALL_EXT system.integer.convert 3', token);
  }
  function operation(op, leftType, rightType, token, checked = checkedArithmetic) {
    if (op === '/' || op === '%') {
      emit(`CALL_EXT system.int32.${op === '/' ? 'divide' : 'remainder'}${sourceLanguage === 'kotlin' ? '.unchecked' : ''} 2`, token);
      return;
    }
    if (op === 'concat' || op === '+' && (leftType === 'string' || rightType === 'string')) {
      emit('CONCAT', token);
      return;
    }
    if (checked && isInteger(leftType) && ['+', '-', '*'].includes(op)) {
      emit(`CALL_EXT system.int32.${{ '+': 'add', '-': 'subtract', '*': 'multiply' }[op]} 2`, token);
      return;
    }
    const opcode = {
      '+': 'ADD', '-': 'SUB', '*': 'MUL', '==': leftType === 'string' ? 'STREQ' : 'EQ',
      '!=': leftType === 'string' ? 'STRNEQ' : 'NEQ', '<': 'LT', '<=': 'LE', '>': 'GT', '>=': 'GE',
      and: 'AND', or: 'OR', xor: 'NEQ'
    }[op];
    if (!opcode) throw new Error(`C# internal error: unhandled operator '${op}'`);
    emit(opcode, token);
  }
  function expression(node) {
    const token = node.token;
    if (Object.hasOwn(node, 'constant')) {
      if (node.valueType === 'null' || node.nullLiteral) emit('PUSH_NULL', token);
      else emit(node.valueType === 'string' ? `PUSH_STR ${JSON.stringify(node.constant)}`
        : `PUSH_INT ${node.valueType === 'bool' ? Number(node.constant) : node.constant}`, token);
      return;
    }
    switch (node.kind) {
      case 'name': emit(`LOAD_NAME ${node.variable.slot}`, token); break;
      case 'object-value': emit('PUSH_INT 1', token); break;
      case 'field-get':
        emit(`LOAD_NAME ${context.selfSlot}`, token);
        emit(`PUSH_INT ${node.index}`, token);
        emit('CALL_EXT object.get 2', token);
        break;
      case 'field-set':
        emit(`LOAD_NAME ${context.selfSlot}`, token);
        emit(`PUSH_INT ${node.index}`, token);
        expression(node.value);
        emit('CALL_EXT object.set 3', token);
        emit(`STORE_NAME ${temporary()}`, token);
        break;
      case 'array-new':
        expression(node.length);
        emit('CALL_EXT object.new 1', token);
        break;
      case 'index-get':
        expression(node.receiver);
        expression(node.index);
        emit('CALL_EXT object.get 2', token);
        break;
      case 'property': {
        if (node.arraySize) {
          expression(node.receiver);
          emit('CALL_EXT object.length 1', token);
          break;
        }
        let skip = null;
        if (node.safe) {
          skip = fresh('SAFE_PROPERTY_SKIP');
          const receiver = temporary();
          expression(node.receiver);
          emit(`STORE_NAME ${receiver}`, token);
          emit(`LOAD_NAME ${receiver}`, token);
          emit(`JZ ${skip}`, token);
          emit(`LOAD_NAME ${receiver}`, token);
        } else expression(node.receiver);
        const instance = instantiate(node.method, node.genericTypes.map(concrete));
        emit(`CALL ${instance.label} 1`, token);
        if (skip) {
          const end = fresh('SAFE_PROPERTY_END');
          emit(`JMP ${end}`, token);
          emit(`${skip}:`, token);
          emit('PUSH_NULL', token);
          emit(`${end}:`, token);
        }
        break;
      }
      case 'string-length':
        expression(node.value); emit('CALL_EXT system.string.length 1', token);
        break;
      case 'scalar-string': asString(node.value); break;
      case 'range-test': {
        const slots = [node.start, node.end, node.value].map(operand => {
          expression(operand);
          const slot = temporary();
          emit(`STORE_NAME ${slot}`, operand.token);
          return slot;
        });
        emit(`LOAD_NAME ${slots[2]}`, token); emit(`LOAD_NAME ${slots[0]}`, token); emit('GE', token);
        emit(`LOAD_NAME ${slots[2]}`, token); emit(`LOAD_NAME ${slots[1]}`, token);
        emit(node.exclusive ? 'LT' : 'LE', token); emit('AND', token);
        if (node.negated) emit('NOT', token);
        break;
      }
      case 'overflow': expression(node.value); break;
      case 'not-null':
        expression(node.value);
        emit('CALL_EXT system.reference.notnull 1', token);
        break;
      case 'throw':
        expression(node.value);
        const thrown = temporary();
        emit(`STORE_NAME ${thrown}`, token);
        if (!context.exceptionDepth)
          for (const finalizer of [...context.finallyStack].reverse()) statement(finalizer);
        emit(`LOAD_NAME ${thrown}`, token);
        emit('CALL_EXT system.exception.throw 1', token);
        break;
      case 'convert':
        if (node.conversion === 'scalar-to-string') asString(node.value);
        else {
          expression(node.value);
          if (node.conversion === 'integer') integerConversion(node.targetType, node.checkedArithmetic, token);
          else if (node.conversion === 'boolean-to-integer') {
            emit(`PUSH_INT ${node.targetType === 'byte' ? 255 : node.targetType === 'ushort' ? 65535 : -1}`, token);
            emit('MUL', token);
          } else if (node.conversion === 'integer-to-boolean') {
            emit('PUSH_INT 0', token); emit('NEQ', token);
          }
        }
        break;
      case 'unary':
        if (node.op === '-') emit('PUSH_INT 0', token);
        expression(node.value);
        if (node.op === '-') {
          operation('-', 'int', 'int', token, node.checkedArithmetic);
          integerConversion(node.valueType, node.checkedArithmetic, token);
        }
        if (node.op === '!') emit('NOT', token);
        break;
      case 'binary':
        if (node.op === '..' || node.op === '..<') {
          expression(node.left); emit(`STORE_NAME ${temporary()}`, node.left.token);
          if (node.left.kind === 'index-get') {
            expression(node.left.receiver);
            expression(node.left.index);
            expression(node.right);
            emit('CALL_EXT object.set 3', token);
            emit(`STORE_NAME ${temporary()}`, token);
            break;
          }
          expression(node.right); emit(`STORE_NAME ${temporary()}`, node.right.token);
          break;
        }
        if (node.op === '?:') {
          const fallback = fresh('ELVIS_FALLBACK');
          const end = fresh('ELVIS_END');
          const value = temporary();
          expression(node.left);
          emit(`STORE_NAME ${value}`, node.left.token);
          emit(`LOAD_NAME ${value}`, node.left.token);
          emit(`JZ ${fallback}`, node.token);
          emit(`LOAD_NAME ${value}`, node.left.token);
          emit(`JMP ${end}`, node.token);
          emit(`${fallback}:`, node.token);
          expression(node.right);
          emit(`${end}:`, node.token);
          break;
        }
        if (node.op === '&&' || node.op === '||') {
          const alternative = fresh('LOGICAL'), end = fresh('LOGICAL_END');
          expression(node.left);
          if (node.op === '||') emit('NOT', token);
          emit(`JZ ${alternative}`, token);
          expression(node.right); emit(`JMP ${end}`, token);
          emit(`${alternative}:`, token); emit(`PUSH_INT ${node.op === '||' ? 1 : 0}`, token);
          emit(`${end}:`, token);
        } else {
          const string = node.op === 'concat' || node.op === '+' && node.valueType === 'string';
          if (string) { asString(node.left); asString(node.right); }
          else { expression(node.left); expression(node.right); }
          const numeric = node.operationType;
          operation(node.op, numeric || concrete(node.left.valueType), numeric || concrete(node.right.valueType), token, node.checkedArithmetic);
          if (numeric && node.valueType !== 'bool') integerConversion(numeric, node.checkedArithmetic, token);
        }
        break;
      case 'assign': {
        if (node.left.kind === 'index-get') {
          if (node.op === '=') {
            expression(node.left.receiver);
            expression(node.left.index);
            expression(node.right);
          } else {
            // Compound assignment reads the current element once, with the
            // receiver and index each evaluated exactly once.
            const receiver = temporary(), index = temporary();
            expression(node.left.receiver);
            emit(`STORE_NAME ${receiver}`, token);
            expression(node.left.index);
            emit(`STORE_NAME ${index}`, token);
            emit(`LOAD_NAME ${receiver}`, token);
            emit(`LOAD_NAME ${index}`, token);
            emit(`LOAD_NAME ${receiver}`, token);
            emit(`LOAD_NAME ${index}`, token);
            emit('CALL_EXT object.get 2', token);
            expression(node.right);
            operation(node.op[0], node.operationType || concrete(node.left.valueType),
              node.operationType || concrete(node.right.valueType), token, node.checkedArithmetic);
            if (node.assignmentConversion) integerConversion(node.assignmentConversion, node.checkedArithmetic, token);
          }
          emit('CALL_EXT object.set 3', token);
          emit(`STORE_NAME ${temporary()}`, token);
          break;
        }
        if (node.op !== '=') emit(`LOAD_NAME ${node.left.variable.slot}`, token);
        if (node.op === '+=' && node.valueType === 'string') asString(node.right);
        else expression(node.right);
        if (node.op !== '=') {
          operation(node.op[0], node.operationType || concrete(node.left.valueType),
            node.operationType || concrete(node.right.valueType), token, node.checkedArithmetic);
          if (node.assignmentConversion) integerConversion(node.assignmentConversion, node.checkedArithmetic, token);
        }
        emit(`STORE_NAME ${node.left.variable.slot}`, token);
        emit(`LOAD_NAME ${node.left.variable.slot}`, token);
        break;
      }
      case 'increment': {
        const slot = node.value.variable.slot, previous = node.prefix ? null : temporary();
        if (previous) { emit(`LOAD_NAME ${slot}`, token); emit(`STORE_NAME ${previous}`, token); }
        emit(`LOAD_NAME ${slot}`, token); emit('PUSH_INT 1', token);
        operation(node.op === '++' ? '+' : '-', 'int', 'int', token, node.checkedArithmetic);
        integerConversion(node.valueType, node.checkedArithmetic, token);
        emit(`STORE_NAME ${slot}`, token);
        emit(`LOAD_NAME ${previous || slot}`, token);
        break;
      }
      case 'conditional': {
        const no = fresh('CONDITIONAL'), end = fresh('CONDITIONAL_END');
        expression(node.condition); emit(`JZ ${no}`, token);
        expression(node.yes); emit(`JMP ${end}`, token);
        emit(`${no}:`, token); expression(node.no); emit(`${end}:`, token);
        break;
      }
      case 'call':
        if (node.consoleName) {
          if (node.args.length) {
            if (concrete(node.args[0].valueType) === 'bool') asString(node.args[0]); else expression(node.args[0]);
            emit('PRINT', token);
          }
          if (node.consoleName.endsWith('WriteLine')) emit('PRINT_NL', token);
        } else {
          let skip = null;
          if (node.safe) {
            const receiver = temporary();
            skip = fresh('SAFE_CALL_SKIP');
            expression(node.receiver);
            emit(`STORE_NAME ${receiver}`, token);
            emit(`LOAD_NAME ${receiver}`, token);
            emit(`JZ ${skip}`, token);
          }
          if (node.receiver && node.method.instance) expression(node.receiver);
          node.args.forEach(expression);
          const instance = instantiate(node.method, node.genericTypes.map(concrete));
          const opcode = node.method.external?.startsWith('host.')
            || node.method.external?.startsWith('system.') ? 'CALL_EXT' : 'CALL';
          emit(`${opcode} ${instance.label} ${node.args.length + (node.method.instance ? 1 : 0)}`, token);
          if (skip) {
            if (node.valueType !== 'void') {
              const end = fresh('SAFE_CALL_END');
              emit(`JMP ${end}`, token);
              emit(`${skip}:`, token);
              emit('PUSH_NULL', token);
              emit(`${end}:`, token);
            } else emit(`${skip}:`, token);
          }
        }
        break;
      default: throw new Error(`C# internal error: unhandled expression '${node.kind}'`);
    }
  }
  function discard(node) {
    expression(node);
    if (node.valueType !== 'void') emit(`STORE_NAME ${temporary()}`, node.token);
  }
  function statement(node) {
    const token = node.token;
    switch (node.kind) {
      case 'empty': break;
      case 'overflow': statement(node.body); break;
      case 'block': node.statements.forEach(statement); break;
      case 'declarations': node.declarations.forEach(statement); break;
      case 'declare':
        for (const item of node.declarations) {
          if (item.value) { expression(item.value); emit(`STORE_NAME ${item.variable.slot}`, item.token); }
        }
        break;
      case 'catch-parameter': break;
      case 'expressions': node.values.forEach(discard); break;
      case 'try':
        {
        const catchLabel = node.catches.length ? fresh('TRY_CATCH') : null;
        const throwLabel = node.finallyBody && !node.catches.length ? fresh('TRY_FINALLY_THROW') : null;
        const end = fresh('TRY_END');
        emit(`TRY_BEGIN ${catchLabel || throwLabel}`, token);
        if (node.finallyBody) context.finallyStack.push(node.finallyBody);
        context.exceptionDepth += 1;
        statement(node.body);
        context.exceptionDepth -= 1;
        if (node.finallyBody) context.finallyStack.pop();
        emit('TRY_END', token);
        emit(`JMP ${end}`, token);
        if (catchLabel) {
          emit(`${catchLabel}:`, token);
          const handler = node.catches[0];
          emit(`STORE_NAME ${handler.parameter.variable.slot}`, handler.parameter.token);
          if (node.finallyBody) context.finallyStack.push(node.finallyBody);
          statement(handler.body);
          if (node.finallyBody) statement(node.finallyBody);
          if (node.finallyBody) context.finallyStack.pop();
          emit(`JMP ${end}`, token);
        }
        if (throwLabel) {
          emit(`${throwLabel}:`, token);
          const thrown = temporary();
          emit(`STORE_NAME ${thrown}`, token);
          statement(node.finallyBody);
          emit(`LOAD_NAME ${thrown}`, token);
          emit('RETHROW', token);
        }
        emit(`${end}:`, token);
        }
        break;
      case 'return':
        for (const finalizer of [...context.finallyStack].reverse()) statement(finalizer);
        if (node.value) expression(node.value);
        emit('RET', token);
        break;
      case 'if': {
        const no = fresh('ELSE'), end = fresh('IF_END');
        expression(node.condition); emit(`JZ ${no}`, token);
        statement(node.then); emit(`JMP ${end}`, token); emit(`${no}:`, token);
        if (node.otherwise) statement(node.otherwise);
        emit(`${end}:`, token);
        break;
      }
      case 'for': case 'while': case 'do': {
        const start = fresh('LOOP'), next = fresh('CONTINUE'), end = fresh('LOOP_END');
        if (node.init) statement(node.init);
        context.loops.push({ next, end });
        emit(`${start}:`, token);
        if (node.kind !== 'do' && node.condition) {
          expression(node.condition); emit(`JZ ${end}`, token);
        }
        statement(node.body); emit(`${next}:`, token);
        if (node.inclusiveRange) {
          expression(node.condition.left); expression(node.condition.right);
          emit('EQ', token); emit('NOT', token); emit(`JZ ${end}`, token);
        }
        if (node.increment) node.increment.forEach(discard);
        if (node.kind === 'do') { expression(node.condition); emit(`JZ ${end}`, token); }
        emit(`JMP ${start}`, token); emit(`${end}:`, token);
        context.loops.pop();
        break;
      }
      case 'break':
        for (const finalizer of [...context.finallyStack].reverse()) statement(finalizer);
        emit(`JMP ${context.loops.at(-1).end}`, token);
        break;
      case 'continue':
        for (const finalizer of [...context.finallyStack].reverse()) statement(finalizer);
        emit(`JMP ${context.loops.at(-1).next}`, token);
        break;
      default: throw new Error(`C# internal error: unhandled statement '${node.kind}'`);
    }
  }
  const main = instantiate(entry, []);
  emit('JMP MAIN', entry.token);
  // Validate all templates before instantiation; otherwise specialization could
  // accidentally make illegal generic operations (such as T + T) appear legal.
  for (const method of methods.values()) if (!method.typeParams.length && !method.globalsInit) instantiate(method, []);
  for (let index = 0; index < pending.length; index++) {
    const instance = pending[index], { method, bindings, label } = instance;
    const selfSlot = method.instance ? method.params[0]?.variable.slot : null;
    const metadata = {
      label,
      name: method.key, signature: method.signature, params: method.params.map(param => param.variable.slot),
      locals: method.locals.map(local => local.slot),
      parameterTypes: method.params.map(param => bindings.get(param.type.name) || param.type.name),
      returnType: bindings.get(method.returnType.name) || method.returnType.name,
      visibility: method.modifiers.has('public') ? 'public' : method.modifiers.has('internal') ? 'internal' : 'private',
      typeArguments: instance.typeArgs,
      variables: [...method.params.map(param => param.variable), ...method.locals]
        .map(variable => ({ ...variable, type: bindings.get(variable.type) || variable.type }))
    };
    procedures[label] = metadata;
    context = { bindings, metadata, temporary: 0, loops: [], finallyStack: [], exceptionDepth: 0, selfSlot };
    emit(`${label}:`, method.token);
    if (method.constructorType && method.fields?.length) {
      emit(`PUSH_INT ${method.fields.length}`, method.token);
      emit('CALL_EXT object.new 1', method.token);
      const objectSlot = temporary();
      emit(`STORE_NAME ${objectSlot}`, method.token);
      method.params.forEach((param, index) => {
        emit(`LOAD_NAME ${objectSlot}`, param.token);
        emit(`PUSH_INT ${index}`, param.token);
        emit(`LOAD_NAME ${param.variable.slot}`, param.token);
        emit('CALL_EXT object.set 3', param.token);
        emit(`STORE_NAME ${temporary()}`, param.token);
      });
      for (const field of method.fieldInitializers || []) {
        emit(`LOAD_NAME ${objectSlot}`, field.value.token);
        emit(`PUSH_INT ${field.index}`, field.value.token);
        expression(field.value);
        emit('CALL_EXT object.set 3', field.value.token);
        emit(`STORE_NAME ${temporary()}`, field.value.token);
      }
      emit(`LOAD_NAME ${objectSlot}`, method.token);
    } else statement(method.body);
    emit('RET', method.token);
  }
  emit('MAIN:', entry.token);
  // Module globals initialize in the root frame before the entry point, so
  // every procedure reaches them through frame-chain name resolution.
  const globalsInit = [...methods.values()].find(method => method.globalsInit);
  if (globalsInit) {
    context = { bindings: new Map(), metadata: { locals: [] }, temporary: 0, loops: [], finallyStack: [], exceptionDepth: 0, selfSlot: null };
    statement(globalsInit.body);
  }
  if (service?.dispatchEndpoints) {
    for (const endpoint of service.dispatchEndpoints) {
      const method = [...methods.values()].find(item => item.name === endpoint.handler);
      const next = fresh('ENDPOINT_NEXT');
      emit('CALL_EXT host.event_method 0', method.token);
      emit(`PUSH_STR ${JSON.stringify(endpoint.verb)}`, method.token);
      emit('STREQ', method.token); emit(`JZ ${next}`, method.token);
      emit('CALL_EXT host.event_path 0', method.token);
      emit(`PUSH_STR ${JSON.stringify(endpoint.path)}`, method.token);
      emit('STREQ', method.token); emit(`JZ ${next}`, method.token);
      emit(`CALL ${instantiate(method, []).label} 0`, method.token);
      emit('STORE_NAME __service_response', method.token);
      emit('MAP_RETURN __service_response', method.token);
      emit('HALT', method.token); emit(`${next}:`, method.token);
    }
    emit('PUSH_INT 404', entry.token);
    emit('CALL_EXT host.http_status 1', entry.token);
    emit('STORE_NAME __service_discard', entry.token);
    emit('PUSH_STR "{\\"error\\":\\"Service endpoint not found\\"}"', entry.token);
    emit('STORE_NAME __service_response', entry.token);
    emit('MAP_RETURN __service_response', entry.token);
  } else {
    emit(`CALL ${main.label} 0`, entry.token);
    if (entry.returnType.name === 'int') emit('STORE_NAME CS_EXIT_CODE', entry.token);
  }
  emit('HALT', entry.token);
  const programId = path.basename(fileName, path.extname(fileName));
  const runtimeUnit = service
    ? { kind: 'service', id: service.id, refreshMs: null }
    : { kind: 'program', id: programId, refreshMs: null };
  return {
    language: sourceLanguage, sourceLanguage, programId, runtimeUnit,
    compilerPipeline: `${sourceLanguage}-to-pcode`, compiledAt: new Date().toISOString(),
    pcodeText: lines.join('\n') + '\n',
    programMap: {
      version: 1, sourceLanguage, runtimeUnit, entryLabel: 'MAIN',
      globals: [...(globalsInit ? globalsInit.locals.map(local => local.slot) : []),
        ...(service?.dispatchEndpoints ? ['__service_response', '__service_discard']
          : entry.returnType.name === 'int' ? ['CS_EXIT_CODE'] : [])], procedures, entries: [], sourceMap,
      libraries: [{ id: SYSTEM_LIBRARY.id, version: SYSTEM_LIBRARY.version }],
      pmachineAbi: PMACHINE_ABI,
      target, targets: service ? ['js', 'esp32'] : [target], abi: { id: 'pulse.scalar', version: 1 },
      ...(service ? service.contract : {})
    }
  };
}
