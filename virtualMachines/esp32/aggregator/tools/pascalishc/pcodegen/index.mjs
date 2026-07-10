function escapeString(text) {
  return String(text || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function procedureLabel(name) {
  return `PROC_${String(name || '').toUpperCase()}`;
}

function emitInstruction(lines, instruction) {
  switch (instruction.op) {
    case 'label':
      lines.push(`${instruction.name}:`);
      return;
    case 'push_int':
      lines.push(`PUSH_INT ${instruction.value}`);
      return;
    case 'push_str':
      lines.push(`PUSH_STR "${escapeString(instruction.value)}"`);
      return;
    case 'load':
      lines.push(`LOAD ${instruction.name}`);
      return;
    case 'store':
      lines.push(`STORE ${instruction.name}`);
      return;
    case 'binary': {
      const opMap = {
        '+': 'ADD',
        '-': 'SUB',
        '*': 'MUL',
        '/': 'DIV',
        '=': 'EQ',
        '<>': 'NEQ',
        '<': 'LT',
        '<=': 'LE',
        '>': 'GT',
        '>=': 'GE'
      };
      const opcode = opMap[instruction.operator];
      if (!opcode) {
        throw new Error(`Unsupported binary operator '${instruction.operator}'`);
      }
      lines.push(opcode);
      return;
    }
    case 'jz':
      lines.push(`JZ ${instruction.label}`);
      return;
    case 'jmp':
      lines.push(`JMP ${instruction.label}`);
      return;
    case 'call':
      lines.push(`CALL ${procedureLabel(instruction.name)} ${instruction.argc}`);
      return;
    case 'print':
      lines.push('PRINT');
      return;
    case 'print_int':
      lines.push('PRINT_INT');
      return;
    case 'print_nl':
      lines.push('PRINT_NL');
      return;
    case 'ret':
      lines.push('RET');
      return;
    case 'halt':
      lines.push('HALT');
      return;
    default:
      throw new Error(`Unsupported IR opcode '${instruction.op}'`);
  }
}

export function emitPcode(ir) {
  const lines = [];
  lines.push('# Auto-generated from ANTLR StandardPascal grammar');
  lines.push('JMP MAIN');

  const procedures = {};
  for (const procedure of ir.procedures || []) {
    const label = procedureLabel(procedure.name);
    lines.push(`${label}:`);
    for (const instruction of procedure.instructions || []) {
      emitInstruction(lines, instruction);
    }
    procedures[label] = {
      name: procedure.name,
      params: procedure.parameters,
      locals: procedure.locals
    };
  }

  lines.push('MAIN:');
  for (const instruction of ir.main || []) {
    emitInstruction(lines, instruction);
  }

  return {
    pcodeText: `${lines.join('\n')}\n`,
    programMap: {
      version: 1,
      generatedAt: new Date().toISOString(),
      serviceId: ir.name,
      runtimeUnit: {
        kind: 'program',
        id: ir.name,
        refreshMs: null
      },
      executionModel: 'standard-pascal',
      sourceLanguage: 'pascal',
      globals: ir.globals,
      procedures,
      entryLabel: 'MAIN'
    }
  };
}
