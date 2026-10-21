const keyOf = value => String(value).toLowerCase();

// Type argument lists occur in qualified call names as well as type declarations.
function splitTypes(text) {
  const result = [];
  let depth = 0, start = 0;
  for (let index = 0; index < text.length; index++) {
    if (text[index] === '<') depth++;
    if (text[index] === '>') depth--;
    if (text[index] === ',' && depth === 0) {
      result.push(text.slice(start, index));
      start = index + 1;
    }
  }
  result.push(text.slice(start));
  return result;
}

function typeFromName(text) {
  const match = /^([^<>]+?)(?:<(.*)>)?$/.exec(text.trim());
  if (!match) throw new Error(`Invalid generic type argument: ${text}`);
  const rawId = match[1].trim();
  const id = ({ double: 'real', char: 'string' })[keyOf(rawId)] || rawId;
  return {
    type: 'TypeRef', kind: ['integer', 'string', 'real', 'boolean', 'decimal'].includes(keyOf(id)) ? 'simple' : 'user',
    id, genericArgs: match[2] === undefined ? [] : splitTypes(match[2]).map(typeFromName)
  };
}

export function specializeGenerics(ast) {
  const declarations = [...ast.types, ...ast.classes];
  const templates = new Map(declarations.filter(item => item.genericParams?.length).map(item => [keyOf(item.name), item]));
  const byName = new Map(declarations.map(item => [keyOf(item.name), item]));
  const instances = new Map(), active = new Set(), methodInstances = new Map();
  const output = new Map();
  let sequence = 0;

  function canonicalArgument(type, seen = new Set()) {
    const key = keyOf(type.id);
    const declaration = byName.get(key) || output.get(key);
    if (declaration?.type === 'TypeDecl' && !(type.genericArgs?.length)) {
      if (seen.has(key)) throw new Error(`Recursive type alias: ${type.id}`);
      return canonicalArgument(declaration.targetType, new Set(seen).add(key));
    }
    if (type.kind === 'user' && !declaration) throw new Error(`Unknown generic type argument: ${type.id}`);
    return type;
  }

  function shape(type) {
    if (!type || typeof type !== 'object') return type;
    if (Array.isArray(type)) return type.map(shape);
    return Object.fromEntries(Object.entries(type)
      .filter(([key]) => !['sourceLocation', 'raw'].includes(key))
      .map(([key, value]) => [key, typeof value === 'string' ? value.toLowerCase() : shape(value)]));
  }

  function checkArguments(template, args) {
    if (args.length !== template.genericParams.length) {
      throw new Error(`Generic ${template.name} requires ${template.genericParams.length} type arguments; received ${args.length}`);
    }
    template.genericParams.forEach((parameter, index) => {
      if (parameter.constraint === 'class' && !isClass(args[index])) {
        throw new Error(`Generic ${template.name} type argument ${index + 1} violates class constraint`);
      }
    });
  }

  function isClass(type, seen = new Set()) {
    if (type?.kind !== 'user' || seen.has(keyOf(type.id))) return false;
    seen.add(keyOf(type.id));
    const declaration = output.get(keyOf(type.id)) || byName.get(keyOf(type.id));
    return declaration?.type === 'ClassDecl' && !declaration.valueRecord
      || declaration?.type === 'TypeDecl' && isClass(declaration.targetType, seen);
  }

  function instantiate(template, args) {
    args = args.map(argument => canonicalArgument(argument));
    checkArguments(template, args);
    const identity = keyOf(template.name) + ':' + JSON.stringify(shape(args));
    if (instances.has(identity)) return instances.get(identity);
    if (sequence >= 128 || active.size >= 32) throw new Error('Generic specialization capacity exceeded');
    const name = `${template.name}__generic_${++sequence}`;
    instances.set(identity, name);
    output.set(keyOf(name), { ...template, name, genericParams: [] });
    active.add(identity);
    const bindings = new Map(template.genericParams.map((parameter, index) => [keyOf(parameter.name || parameter), args[index]]));
    const concrete = substitute({ ...template, genericParams: [], name }, bindings);
    concrete.genericSpecialization = true;
    active.delete(identity);
    output.set(keyOf(name), concrete);
    (template.type === 'ClassDecl' ? ast.classes : ast.types).push(concrete);
    return name;
  }

  function callName(name, bindings) {
    const parts = [];
    let depth = 0, start = 0;
    for (let index = 0; index <= name.length; index++) {
      if (name[index] === '<') depth++;
      if (name[index] === '>') depth--;
      if (index === name.length || name[index] === '.' && depth === 0) {
        parts.push(name.slice(start, index)); start = index + 1;
      }
    }
    if (parts[0]?.includes('<')) {
      const type = substitute(typeFromName(parts[0]), bindings);
      parts[0] = type.id;
    }
    if (parts.length === 2 && parts[1].includes('<')) {
      const methodType = typeFromName(parts[1]);
      const owner = output.get(keyOf(parts[0])) || byName.get(keyOf(parts[0]));
      const method = owner?.members?.find(item => keyOf(item.name) === keyOf(methodType.id));
      if (!method?.genericParams?.length) throw new Error(`Unknown generic method ${name}`);
      if (!method.isStatic) throw new Error(`Generic method ${name} must be static`);
      const args = methodType.genericArgs.map(argument => substitute(argument, bindings));
      for (let index = 0; index < args.length; index++) args[index] = canonicalArgument(args[index]);
      checkArguments(method, args);
      const identity = keyOf(owner.name) + '.' + keyOf(method.name) + ':' + JSON.stringify(shape(args));
      if (!methodInstances.has(identity)) {
        if (sequence >= 128) throw new Error('Generic specialization capacity exceeded');
        const concreteName = `${method.name}__generic_${++sequence}`;
        methodInstances.set(identity, concreteName);
        const parameters = new Map(method.genericParams.map((parameter, index) => [keyOf(parameter.name || parameter), args[index]]));
        owner.members.push({ ...substitute({ ...method, genericParams: [], name: concreteName }, parameters), genericSpecialization: true });
      }
      parts[1] = methodInstances.get(identity);
    }
    return parts.join('.');
  }

  function substitute(value, bindings = new Map()) {
    if (Array.isArray(value)) return value.map(item => substitute(item, bindings));
    if (!value || typeof value !== 'object') return value;
    if (value.type === 'MethodImplDecl') return structuredClone(value);
    if (['TypeDecl', 'ClassDecl'].includes(value.type) && value.genericParams?.length) return structuredClone(value);
    if (value.type === 'ClassMethodDecl' && value.genericParams?.length) return structuredClone(value);
    if (value.type === 'TypeRef' && value.kind === 'user') {
      const key = keyOf(value.id);
      if (bindings.has(key)) return structuredClone(bindings.get(key));
      const args = (value.genericArgs || []).map(argument => substitute(argument, bindings));
      const template = templates.get(key);
      if (template) return { ...value, id: instantiate(template, args), genericArgs: [] };
      if (args.length) throw new Error(`Type ${value.id} does not accept generic arguments`);
    }
    const result = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, substitute(item, bindings)]));
    if (['Call', 'CallExpr', 'Identifier'].includes(result.type) && result.name?.includes('<')) {
      result.name = callName(result.name, bindings);
    }
    return result;
  }

  for (const routine of ast.procedures || []) {
    if (routine.genericParams?.length) throw new Error('Standalone generic routines are not supported; use a static generic method');
  }
  ast.types = ast.types.filter(item => !item.genericParams?.length);
  ast.classes = ast.classes.filter(item => !item.genericParams?.length);
  for (const key of ['variables', 'procedures', 'runtimeUnit', 'distributedTables']) ast[key] = substitute(ast[key]);
  for (const key of ['types', 'classes']) {
    for (let index = 0; index < ast[key].length; index++) {
      ast[key][index] = substitute(ast[key][index]);
      output.set(keyOf(ast[key][index].name), ast[key][index]);
    }
  }
  for (const declaration of ast.classes) declaration.members = declaration.members.filter(member => !member.genericParams?.length);

  function validateLayout(type, path = new Set()) {
    if (!type) return;
    if (type.kind === 'fixed-array') return validateLayout(type.elementType, path);
    if (type.kind === 'record') {
      for (const field of type.fields || []) validateLayout(field.dataType, path);
    }
    if (type.kind !== 'user') return;
    const key = keyOf(type.id), declaration = output.get(key) || byName.get(key);
    if (!declaration || declaration.type === 'ClassDecl' && !declaration.valueRecord) return;
    if (path.has(key)) throw new Error(`Recursive value layout: ${type.id}`);
    const next = new Set(path).add(key);
    if (declaration.type === 'TypeDecl') validateLayout(declaration.targetType, next);
    else for (const field of declaration.members.filter(member => member.type === 'ClassFieldDecl')) {
      validateLayout(field.dataType, next);
    }
  }
  for (const declaration of [...ast.types, ...ast.classes]) {
    validateLayout({ kind: 'user', id: declaration.name });
  }
}
