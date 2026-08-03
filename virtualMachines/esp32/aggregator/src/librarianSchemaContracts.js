function normalizeTypeId(value) {
  return String(value || '').trim().replace(/<.*$/, '').toLowerCase();
}

function isContainerNode(node) {
  return ['sequence', 'choice', 'all', 'complextype'].includes(String(node?.valueType || '').toLowerCase());
}

export function collectLibrarianFieldPaths(structure) {
  const paths = [];
  function visit(node, parentPath = '') {
    if (!node || typeof node !== 'object') return;
    const name = String(node.name || '').trim();
    const contributesPath = name && name !== 'root' && !isContainerNode(node);
    const currentPath = contributesPath ? (parentPath ? `${parentPath}.${name}` : name) : parentPath;
    if (contributesPath && !paths.includes(currentPath)) paths.push(currentPath);
    for (const child of Array.isArray(node.children) ? node.children : []) visit(child, currentPath);
  }
  visit(structure);
  return paths;
}

export function buildPascalishLibrarianContracts(dataTypes, schemas) {
  const typeNames = new Set(
    (Array.isArray(dataTypes) ? dataTypes : [])
      .map(type => normalizeTypeId(type?.id))
      .filter(Boolean)
  );
  const fieldSets = new Map();
  const subschemaContracts = {};

  for (const schema of Array.isArray(schemas) ? schemas : []) {
    if (schema?.virtual && schema?.type === 'subschema') {
      const id = normalizeTypeId(schema.name || schema.id);
      if (!id) continue;
      const accessibleFields = Array.from(new Set(
        (Array.isArray(schema.accessibleFields) ? schema.accessibleFields : collectLibrarianFieldPaths(schema.structure))
          .map(field => String(field || '').trim())
          .filter(Boolean)
      )).sort((a, b) => a.localeCompare(b));
      typeNames.add(id);
      fieldSets.set(id, new Set(accessibleFields));
      subschemaContracts[id] = {
        id,
        parentTypeId: normalizeTypeId(schema.typeId),
        parentSchemaPath: String(schema.parentSchemaPath || ''),
        accessibleFields,
      };
      continue;
    }

    const typeId = normalizeTypeId(schema?.typeId);
    if (!typeId) continue;
    typeNames.add(typeId);
    if (!fieldSets.has(typeId)) fieldSets.set(typeId, new Set());
    for (const field of collectLibrarianFieldPaths(schema.structure)) fieldSets.get(typeId).add(field);
  }

  return {
    typeNames: Array.from(typeNames).sort((a, b) => a.localeCompare(b)),
    typeFieldMap: Object.fromEntries(
      Array.from(fieldSets.entries()).map(([typeId, fields]) => [
        typeId,
        Array.from(fields).sort((a, b) => a.localeCompare(b))
      ])
    ),
    subschemaContracts,
  };
}

function pathIsAccessible(fieldPath, accessibleFields) {
  const path = String(fieldPath || '').trim();
  return accessibleFields.some(allowed => path === allowed || path.startsWith(`${allowed}.`));
}

export function validatePascalishSubschemaMappings(dataMappings, subschemas) {
  const contracts = new Map();
  for (const subschema of Array.isArray(subschemas) ? subschemas : []) {
    const id = normalizeTypeId(subschema?.id || subschema?.name);
    if (!id) continue;
    contracts.set(id, {
      id,
      parentTypeId: normalizeTypeId(subschema?.parentTypeId),
      parentSchemaPath: String(subschema.parentSchemaPath || ''),
      accessibleFields: (Array.isArray(subschema.accessibleFields) ? subschema.accessibleFields : [])
        .map(field => String(field || '').trim())
        .filter(Boolean),
    });
  }

  const errors = [];
  const usedContracts = new Set();
  for (const mapping of Array.isArray(dataMappings) ? dataMappings : []) {
    const sourceTypeId = normalizeTypeId(mapping?.sourceTypeId);
    const targetTypeId = normalizeTypeId(mapping?.targetTypeId);
    const sourceContract = contracts.get(sourceTypeId);
    const targetContract = contracts.get(targetTypeId);
    if (sourceContract) usedContracts.add(sourceContract.id);
    if (targetContract) usedContracts.add(targetContract.id);

    for (const item of Array.isArray(mapping?.items) ? mapping.items : []) {
      if (sourceContract && !pathIsAccessible(item.sourcePath, sourceContract.accessibleFields)) {
        errors.push(`Mapper ${mapping.id}: source field "${item.sourcePath}" is not accessible in subschema "${sourceContract.id}"`);
      }
      if (targetContract && !pathIsAccessible(item.targetPath, targetContract.accessibleFields)) {
        errors.push(`Mapper ${mapping.id}: target field "${item.targetPath}" is not accessible in subschema "${targetContract.id}"`);
      }
    }
  }

  return {
    errors,
    usedContracts: Array.from(usedContracts).map(id => contracts.get(id)),
  };
}