function lowerExpression(node, instructions) {
  if (node.kind === 'Literal') {
    if (node.literalType === 'string') {
      instructions.push({ op: 'push_str', value: node.value });
      return;
    }
    instructions.push({ op: 'push_int', value: node.value });
    return;
  }

  if (node.kind === 'Identifier') {
    instructions.push({ op: 'load', name: node.name });
    return;
  }

  if (node.kind === 'UnaryExpression') {
    instructions.push({ op: 'push_int', value: 0 });
    lowerExpression(node.argument, instructions);
    instructions.push({ op: 'binary', operator: '-' });
    return;
  }

  if (node.kind === 'BinaryExpression') {
    lowerExpression(node.left, instructions);
    lowerExpression(node.right, instructions);
    instructions.push({ op: 'binary', operator: node.operator });
    return;
  }

  throw new Error(`Unsupported expression node '${node.kind}'`);
}

function nextLabel(state, prefix) {
  state.labelId += 1;
  return `${prefix}_${state.labelId}`;
}

function lowerStatement(node, instructions, state) {
  if (!node) return;

  if (node.kind === 'Block') {
    for (const statement of node.body || []) {
      lowerStatement(statement, instructions, state);
    }
    return;
  }

  if (node.kind === 'Assignment') {
    lowerExpression(node.expression, instructions);
    instructions.push({ op: 'store', name: node.target.name });
    return;
  }

  if (node.kind === 'IfStatement') {
    const elseLabel = nextLabel(state, 'ELSE');
    const endLabel = nextLabel(state, 'ENDIF');
    lowerExpression(node.condition, instructions);
    instructions.push({ op: 'jz', label: elseLabel });
    lowerStatement(node.thenBranch, instructions, state);
    instructions.push({ op: 'jmp', label: endLabel });
    instructions.push({ op: 'label', name: elseLabel });
    lowerStatement(node.elseBranch, instructions, state);
    instructions.push({ op: 'label', name: endLabel });
    return;
  }

  if (node.kind === 'FunctionCall') {
    if (String(node.name).toLowerCase() === 'writeln') {
      for (const argument of node.arguments || []) {
        lowerExpression(argument, instructions);
        instructions.push({ op: argument.kind === 'Literal' && argument.literalType === 'string' ? 'print' : 'print_int' });
      }
      instructions.push({ op: 'print_nl' });
      return;
    }

    for (const argument of node.arguments || []) {
      lowerExpression(argument, instructions);
    }
    instructions.push({ op: 'call', name: node.name, argc: (node.arguments || []).length });
    return;
  }

  throw new Error(`Unsupported statement node '${node.kind}'`);
}

export function lowerToIr(ast, symbols) {
  const state = { labelId: 0 };
  const procedures = (ast.block.procedures || []).map(procedure => {
    const instructions = [];
    const parameterNames = new Set((procedure.parameters || []).map(item => item.name));

    for (const declaration of procedure.declarations || []) {
      if (!parameterNames.has(declaration.name)) {
        instructions.push({ op: 'push_int', value: 0 });
        instructions.push({ op: 'store', name: declaration.name });
      }
    }

    lowerStatement(procedure.body, instructions, state);
    instructions.push({ op: 'ret' });

    return {
      name: procedure.name,
      parameters: (procedure.parameters || []).map(item => item.name),
      locals: (procedure.declarations || []).map(item => item.name),
      instructions
    };
  });

  const main = [];
  for (const declaration of symbols.globals || []) {
    main.push({ op: 'push_int', value: 0 });
    main.push({ op: 'store', name: declaration.name });
  }
  lowerStatement(ast.block.body, main, state);
  main.push({ op: 'halt' });

  return {
    name: ast.name,
    globals: (symbols.globals || []).map(item => item.name),
    procedures,
    main
  };
}
