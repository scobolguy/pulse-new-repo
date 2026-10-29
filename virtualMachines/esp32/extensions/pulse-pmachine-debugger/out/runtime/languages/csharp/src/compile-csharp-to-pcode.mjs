import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Parser, tokenize, fail } from './parser.mjs';
import { analyze } from './semantics.mjs';
import { SYSTEM_LIBRARY } from '../../dotnet/system-library.mjs';

export function compileCsharpToPcode(source, { fileName = 'program.cs' } = {}) {
  if (typeof source !== 'string') throw new TypeError('C# source must be a string');
  const program = new Parser(tokenize(source, fileName)).parse();
  const { methods, entry } = analyze(program);
  const sourceLines = source.split(/\r?\n/);
  const lines = [], sourceMap = {}, procedures = {}, instances = new Map(), pending = [];
  let address = 0, labelSerial = 0, context;
  const fresh = prefix => `CS_${prefix}_${labelSerial++}`;
  const emit = (instruction, token) => {
    lines.push(instruction);
    if (!instruction.endsWith(':')) {
      sourceMap[address++] = {
        sourceFile: fileName, sourceLanguage: 'csharp', sourceLine: token.line,
        sourceColumn: token.column, sourceText: sourceLines[token.line - 1] || '', instruction
      };
    }
  };
  function instantiate(method, typeArgs) {
    const identity = `${method.key}<${typeArgs.join(',')}>`;
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
      emit(`JZ ${no}`, node.token);
      emit('PUSH_STR "True"', node.token); emit(`JMP ${end}`, node.token);
      emit(`${no}:`, node.token); emit('PUSH_STR "False"', node.token); emit(`${end}:`, node.token);
    } else if (type === 'int') {
      // CONCAT uses the p-machine's integer display, independent of locale.
      const slot = temporary();
      emit(`STORE_NAME ${slot}`, node.token); emit('PUSH_STR ""', node.token);
      emit(`LOAD_NAME ${slot}`, node.token); emit('CONCAT', node.token);
    }
  }
  function operation(op, leftType, rightType, token) {
    if (op === '/' || op === '%') {
      emit(`CALL_EXT system.int32.${op === '/' ? 'divide' : 'remainder'} 2`, token);
      return;
    }
    if (op === '+' && (leftType === 'string' || rightType === 'string')) {
      emit('CONCAT', token);
      return;
    }
    const opcode = {
      '+': 'ADD', '-': 'SUB', '*': 'MUL', '==': leftType === 'string' ? 'STREQ' : 'EQ',
      '!=': leftType === 'string' ? 'STRNEQ' : 'NEQ', '<': 'LT', '<=': 'LE', '>': 'GT', '>=': 'GE'
    }[op];
    if (!opcode) throw new Error(`C# internal error: unhandled operator '${op}'`);
    emit(opcode, token);
  }
  function expression(node) {
    const token = node.token;
    if (Object.hasOwn(node, 'constant')) {
      emit(node.valueType === 'string' ? `PUSH_STR ${JSON.stringify(node.constant)}`
        : `PUSH_INT ${node.valueType === 'bool' ? Number(node.constant) : node.constant}`, token);
      return;
    }
    switch (node.kind) {
      case 'name': emit(`LOAD_NAME ${node.variable.slot}`, token); break;
      case 'unchecked': expression(node.value); break;
      case 'unary':
        if (node.op === '-') emit('PUSH_INT 0', token);
        expression(node.value);
        if (node.op !== '+') emit(node.op === '-' ? 'SUB' : 'NOT', token);
        break;
      case 'binary':
        if (node.op === '&&' || node.op === '||') {
          const alternative = fresh('LOGICAL'), end = fresh('LOGICAL_END');
          expression(node.left);
          if (node.op === '||') emit('NOT', token);
          emit(`JZ ${alternative}`, token);
          expression(node.right); emit(`JMP ${end}`, token);
          emit(`${alternative}:`, token); emit(`PUSH_INT ${node.op === '||' ? 1 : 0}`, token);
          emit(`${end}:`, token);
        } else {
          const string = node.op === '+' && node.valueType === 'string';
          if (string) { asString(node.left); asString(node.right); }
          else { expression(node.left); expression(node.right); }
          operation(node.op, concrete(node.left.valueType), concrete(node.right.valueType), token);
        }
        break;
      case 'assign': {
        if (node.op !== '=') emit(`LOAD_NAME ${node.left.variable.slot}`, token);
        if (node.op === '+=' && node.valueType === 'string') asString(node.right);
        else expression(node.right);
        if (node.op !== '=') operation(node.op[0], concrete(node.left.valueType), concrete(node.right.valueType), token);
        emit(`STORE_NAME ${node.left.variable.slot}`, token);
        emit(`LOAD_NAME ${node.left.variable.slot}`, token);
        break;
      }
      case 'increment': {
        const slot = node.value.variable.slot, previous = node.prefix ? null : temporary();
        if (previous) { emit(`LOAD_NAME ${slot}`, token); emit(`STORE_NAME ${previous}`, token); }
        emit(`LOAD_NAME ${slot}`, token); emit('PUSH_INT 1', token);
        emit(node.op === '++' ? 'ADD' : 'SUB', token); emit(`STORE_NAME ${slot}`, token);
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
            if (node.args[0].valueType === 'bool') asString(node.args[0]); else expression(node.args[0]);
            emit('PRINT', token);
          }
          if (node.consoleName.endsWith('WriteLine')) emit('PRINT_NL', token);
        } else {
          node.args.forEach(expression);
          const instance = instantiate(node.method, node.genericTypes.map(concrete));
          emit(`CALL ${instance.label} ${node.args.length}`, token);
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
      case 'block': node.statements.forEach(statement); break;
      case 'declare':
        for (const item of node.declarations) {
          if (item.value) { expression(item.value); emit(`STORE_NAME ${item.variable.slot}`, item.token); }
        }
        break;
      case 'expressions': node.values.forEach(discard); break;
      case 'return':
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
        if (node.increment) node.increment.forEach(discard);
        if (node.kind === 'do') { expression(node.condition); emit(`JZ ${end}`, token); }
        emit(`JMP ${start}`, token); emit(`${end}:`, token);
        context.loops.pop();
        break;
      }
      case 'break': emit(`JMP ${context.loops.at(-1).end}`, token); break;
      case 'continue': emit(`JMP ${context.loops.at(-1).next}`, token); break;
      default: throw new Error(`C# internal error: unhandled statement '${node.kind}'`);
    }
  }
  const main = instantiate(entry, []);
  emit(`CALL ${main.label} 0`, entry.token);
  if (entry.returnType.name === 'int') emit('STORE_NAME CS_EXIT_CODE', entry.token);
  emit('HALT', entry.token);
  // Validate all templates before instantiation; otherwise specialization could
  // accidentally make illegal generic operations (such as T + T) appear legal.
  for (const method of methods.values()) if (!method.typeParams.length) instantiate(method, []);
  for (let index = 0; index < pending.length; index++) {
    const instance = pending[index], { method, bindings, label } = instance;
    const metadata = {
      name: method.key, params: method.params.map(param => param.variable.slot),
      locals: method.locals.map(local => local.slot),
      parameterTypes: method.params.map(param => bindings.get(param.type.name) || param.type.name),
      returnType: bindings.get(method.returnType.name) || method.returnType.name,
      typeArguments: instance.typeArgs,
      variables: [...method.params.map(param => param.variable), ...method.locals]
        .map(variable => ({ ...variable, type: bindings.get(variable.type) || variable.type }))
    };
    procedures[label] = metadata;
    context = { bindings, metadata, temporary: 0, loops: [] };
    emit(`${label}:`, method.token);
    statement(method.body);
    emit('RET', method.token);
  }
  const programId = path.basename(fileName, path.extname(fileName));
  const runtimeUnit = { kind: 'program', id: programId, refreshMs: null };
  return {
    language: 'csharp', sourceLanguage: 'csharp', programId, runtimeUnit,
    compilerPipeline: 'csharp-to-pcode', compiledAt: new Date().toISOString(),
    pcodeText: lines.join('\n') + '\n',
    programMap: {
      version: 1, sourceLanguage: 'csharp', runtimeUnit,
      globals: entry.returnType.name === 'int' ? ['CS_EXIT_CODE'] : [], procedures, entries: [], sourceMap,
      libraries: [{ id: SYSTEM_LIBRARY.id, version: SYSTEM_LIBRARY.version }],
      target: 'js'
    }
  };
}

export async function main(args = process.argv.slice(2)) {
  const [input, output, ...extra] = args;
  if (!input || !output || extra.length) throw new Error('Usage: node compile-csharp-to-pcode.mjs input.cs output.pcode');
  const artifact = compileCsharpToPcode(await fs.readFile(input, 'utf8'), { fileName: path.resolve(input) });
  const mapOutput = output.replace(/(?:\.pcode)?$/, '.program.json');
  await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await fs.writeFile(output, artifact.pcodeText, 'utf8');
  await fs.writeFile(mapOutput, JSON.stringify(artifact.programMap, null, 2) + '\n', 'utf8');
  console.log(`Compiled ${input} -> ${output}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`[CSHARP] ${error.message}`); process.exitCode = 1; });
}
