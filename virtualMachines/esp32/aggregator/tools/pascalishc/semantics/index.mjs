function createError(node, message) {
  return {
    line: node?.location?.line || 0,
    column: node?.location?.column || 0,
    message
  };
}

function declareSymbol(table, name, entry, errors, node) {
  if (table.has(name)) {
    errors.push(createError(node, `Duplicate declaration for '${name}'`));
    return;
  }
  table.set(name, entry);
}

function lookupVariable(name, scopeStack) {
  for (let index = scopeStack.length - 1; index >= 0; index -= 1) {
    if (scopeStack[index].has(name)) {
      return scopeStack[index].get(name);
    }
  }
  return null;
}

function analyzeExpression(node, scopeStack, procedures, errors) {
  if (!node) return 'void';

  if (node.kind === 'Literal') {
    return node.literalType;
  }

  if (node.kind === 'Identifier') {
    const symbol = lookupVariable(node.name, scopeStack);
    if (!symbol) {
      errors.push(createError(node, `Unknown identifier '${node.name}'`));
      return 'integer';
    }
    return symbol.dataType;
  }

  if (node.kind === 'UnaryExpression') {
    analyzeExpression(node.argument, scopeStack, procedures, errors);
    return 'integer';
  }

  if (node.kind === 'BinaryExpression') {
    analyzeExpression(node.left, scopeStack, procedures, errors);
    analyzeExpression(node.right, scopeStack, procedures, errors);
    if (['=', '<>', '<', '<=', '>', '>='].includes(node.operator)) {
      return 'boolean';
    }
    return 'integer';
  }

  if (node.kind === 'FunctionCall') {
    if (String(node.name).toLowerCase() === 'writeln') {
      for (const argument of node.arguments || []) {
        analyzeExpression(argument, scopeStack, procedures, errors);
      }
      return 'void';
    }

    const procedure = procedures.get(node.name);
    if (!procedure) {
      errors.push(createError(node, `Unknown procedure '${node.name}'`));
      return 'void';
    }

    const actualCount = (node.arguments || []).length;
    const expectedCount = procedure.parameters.length;
    if (actualCount !== expectedCount) {
      errors.push(createError(node, `Procedure '${node.name}' expects ${expectedCount} argument(s), received ${actualCount}`));
    }

    for (const argument of node.arguments || []) {
      analyzeExpression(argument, scopeStack, procedures, errors);
    }
    return 'void';
  }

  return 'void';
}

function analyzeStatement(node, scopeStack, procedures, errors) {
  if (!node) return;

  if (node.kind === 'Assignment') {
    const symbol = lookupVariable(node.target.name, scopeStack);
    if (!symbol) {
      errors.push(createError(node.target, `Unknown assignment target '${node.target.name}'`));
    }
    analyzeExpression(node.expression, scopeStack, procedures, errors);
    return;
  }

  if (node.kind === 'IfStatement') {
    analyzeExpression(node.condition, scopeStack, procedures, errors);
    analyzeStatement(node.thenBranch, scopeStack, procedures, errors);
    analyzeStatement(node.elseBranch, scopeStack, procedures, errors);
    return;
  }

  if (node.kind === 'FunctionCall') {
    analyzeExpression(node, scopeStack, procedures, errors);
    return;
  }

  if (node.kind === 'Block') {
    for (const statement of node.body || []) {
      analyzeStatement(statement, scopeStack, procedures, errors);
    }
  }
}

export function analyzePascalish(ast) {
  const errors = [];
  const warnings = [];
  const globals = new Map();
  const procedures = new Map();

  for (const declaration of ast.block.declarations || []) {
    declareSymbol(globals, declaration.name, declaration, errors, declaration);
  }

  for (const procedure of ast.block.procedures || []) {
    if (procedures.has(procedure.name)) {
      errors.push(createError(procedure, `Duplicate procedure '${procedure.name}'`));
      continue;
    }
    procedures.set(procedure.name, procedure);
  }

  const globalScopeStack = [globals];

  for (const procedure of ast.block.procedures || []) {
    const localScope = new Map();
    for (const parameter of procedure.parameters || []) {
      declareSymbol(localScope, parameter.name, parameter, errors, parameter);
    }
    for (const declaration of procedure.declarations || []) {
      declareSymbol(localScope, declaration.name, declaration, errors, declaration);
    }

    analyzeStatement(procedure.body, [...globalScopeStack, localScope], procedures, errors);
  }

  analyzeStatement(ast.block.body, globalScopeStack, procedures, errors);

  return {
    errors,
    warnings,
    symbols: {
      globals: [...globals.values()],
      procedures: [...procedures.values()]
    }
  };
}
