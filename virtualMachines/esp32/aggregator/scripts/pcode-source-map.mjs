function executablePcodeLines(pcodeText) {
  return String(pcodeText || '').split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && !line.endsWith(':'));
}

function meaningfulSourceLines(sourceText) {
  return String(sourceText || '').split(/\r?\n/)
    .map((sourceText, index) => ({ sourceLine: index + 1, sourceText: sourceText.trim() }))
    .filter(item => item.sourceText && !item.sourceText.startsWith('//') && !item.sourceText.startsWith("'") && !item.sourceText.startsWith('*>'));
}

export function buildPcodeSourceMap({ pcodeText, sourceText, sourceFile = null, sourceLanguage = 'unknown', sourceLineByAddress = null } = {}) {
  const instructions = executablePcodeLines(pcodeText);
  const sourceLines = meaningfulSourceLines(sourceText);
  const allLines = String(sourceText || '').split(/\r?\n/);
  const fallback = { sourceLine: 1, sourceText: '' };
  const sourceMap = {};

  instructions.forEach((instruction, address) => {
    const exactLine = Array.isArray(sourceLineByAddress) ? Number(sourceLineByAddress[address]) : 0;
    const source = exactLine > 0
      ? { sourceLine: exactLine, sourceText: String(allLines[exactLine - 1] || '').trim() }
      : sourceLines[instructions.length <= 1
        ? 0
        : Math.min(sourceLines.length - 1, Math.floor((address * sourceLines.length) / instructions.length))] || fallback;
    sourceMap[String(address)] = {
      sourceFile,
      sourceLanguage,
      sourceLine: source.sourceLine,
      sourceText: source.sourceText,
      instruction
    };
  });

  return sourceMap;
}