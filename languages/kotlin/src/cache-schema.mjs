export function applyCacheSchemas(unit, schemas) {
  const declarations = unit.programMap.hostCaches || [];
  const declaredByName = new Map(declarations.map(declaration => [declaration.name, declaration]));
  if (declaredByName.size !== declarations.length) throw new Error('Duplicate cache declarations');
  const schemaNames = new Set();
  const sameFields = (left, right) => left.length === right.length
    && left.every(field => right.some(candidate => candidate.name === field.name && candidate.type === field.type));
  const merged = schemas.map(schema => {
    if (schemaNames.has(schema.name)) throw new Error(`Duplicate deployment cache schema '${schema.name}'`);
    schemaNames.add(schema.name);
    const declaration = declaredByName.get(schema.name);
    if (!declaration) return schema;
    if (declaration.capacity !== undefined && schema.capacity !== declaration.capacity)
      throw new Error(`Deployment cache '${schema.name}' capacity conflicts with its declaration`);
    if (Boolean(declaration.virtual) !== Boolean(schema.virtual))
      throw new Error(`Deployment cache '${schema.name}' virtual status conflicts with its declaration`);
    if (declaration.fields?.length && !sameFields(declaration.fields, schema.fields))
      throw new Error(`Deployment cache schema '${schema.name}' does not match its declaration`);
    for (const property of ['uniqueBy', 'latestBy']) {
      if (declaration[property] !== undefined && schema[property] !== undefined
        && declaration[property] !== schema[property])
        throw new Error(`Deployment cache constraint '${property}' conflicts with its declaration`);
    }
    return {
      ...schema,
      ...declaration,
      fields: declaration.fields?.length ? declaration.fields : schema.fields,
      ...(declaration.uniqueBy ?? schema.uniqueBy
        ? { uniqueBy: declaration.uniqueBy ?? schema.uniqueBy } : {}),
      ...(declaration.latestBy ?? schema.latestBy
        ? { latestBy: declaration.latestBy ?? schema.latestBy } : {})
    };
  });
  for (const declaration of declarations) {
    if (schemaNames.has(declaration.name)) continue;
    if (!declaration.virtual && !declaration.fields?.length)
      throw new Error(`Cache '${declaration.name}' requires a deployment field schema`);
    merged.push(declaration);
  }
  unit.programMap.hostCaches = merged;
}
