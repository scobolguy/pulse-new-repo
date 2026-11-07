export function fail(node, message) {
  const language = { vbish: 'VBish', kotlin: 'Kotlin' }[node.sourceLanguage] || 'C#';
  throw new SyntaxError(`${language} ${node.fileName}:${node.line}:${node.column}: ${message}`);
}
