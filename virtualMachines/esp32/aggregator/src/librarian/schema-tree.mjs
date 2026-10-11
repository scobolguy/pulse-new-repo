export function schemaNodeNotice(node) {
  if (node.recursive) return 'recursive reference';
  if (node.truncated) return `expansion limited (${node.truncationReason || 'capacity'})`;
  if (node.unresolved) return 'unresolved external reference';
  return '';
}

export function isSchemaBranch(node) {
  return node.kind === 'branch' || Boolean(node.children?.length)
    || Boolean(schemaNodeNotice(node));
}

export function schemaSimpleTypeSummary(node) {
  const simple = node.simpleType;
  if (simple?.variety === 'list') {
    const values = simple.itemType?.enumValues;
    return Array.isArray(values) && values.length
      ? `list items: ${values.map(value => JSON.stringify(value)).join(', ')}`
      : 'list of simple values';
  }
  if (simple?.variety === 'union') {
    return `union: ${Array.isArray(simple.members) ? simple.members.length : 0} member types`;
  }
  return '';
}
