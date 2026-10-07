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
