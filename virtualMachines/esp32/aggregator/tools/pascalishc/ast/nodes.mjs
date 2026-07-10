export function locationFromToken(token) {
  if (!token) {
    return { line: 0, column: 0 };
  }

  return {
    line: Number(token.line || 0),
    column: Number(token.column || 0) + 1
  };
}

export function createNode(kind, location, fields = {}) {
  return {
    kind,
    location,
    ...fields
  };
}
