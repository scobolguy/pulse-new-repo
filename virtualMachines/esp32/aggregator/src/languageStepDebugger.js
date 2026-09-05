// Shared source-level "single step" narrator shared by the Cobolish, VBish, and
// Pascalish editor pages. This is a flat, non-branching statement narrator (source
// order only, no real interpretation) — it mirrors what the Cobolish stepper already
// did before this file existed, extended to VBish and Pascalish syntax.

function buildCobolishExecutionTabs(source) {
  const lines = String(source || '').split('\n')
  const callables = new Map()
  let procedureStart = lines.findIndex((line) => /^\s*PROCEDURE\s+DIVISION\.?/i.test(line))
  if (procedureStart < 0) procedureStart = 0
  for (let index = procedureStart + 1; index < lines.length; index += 1) {
    const match = /^\s{0,7}([A-Za-z][A-Za-z0-9-]*)\.\s*$/.exec(lines[index])
    if (!match) continue
    let end = lines.length
    for (let next = index + 1; next < lines.length; next += 1) {
      if (/^\s{0,7}[A-Za-z][A-Za-z0-9-]*\.\s*$/.test(lines[next])) { end = next; break }
    }
    const label = match[1]
    callables.set(label.toUpperCase(), { id: `paragraph:${label.toUpperCase()}`, label, startLine: index + 1, content: lines.slice(index, end).join('\n') })
  }
  const mainEnd = callables.size ? Math.min(...Array.from(callables.values(), (tab) => tab.startLine - 1)) : lines.length
  return { main: { id: 'main', label: 'MAIN', startLine: procedureStart + 1, content: lines.slice(procedureStart, mainEnd).join('\n') }, callables }
}

function cobolishExecutableSteps(tab, callables) {
  return tab.content.split('\n').flatMap((line, index) => {
    const lineNumber = tab.startLine + index
    const display = /^\s*DISPLAY\s+"((?:[^"\\]|\\.)*)"\s*\./i.exec(line)
    if (display) return [{ line: lineNumber, kind: 'DISPLAY', value: display[1] }]
    const perform = /^\s*PERFORM\s+([A-Za-z][A-Za-z0-9-]*)\s*\./i.exec(line)
    if (perform) return [{ line: lineNumber, kind: 'PERFORM', value: perform[1], target: callables.get(perform[1].toUpperCase()) || null }]
    if (/^\s*(GOBACK|STOP\s+RUN)\s*\./i.test(line)) return [{ line: lineNumber, kind: 'STOP', value: 'Run unit completed' }]
    return []
  })
}

function buildVbishExecutionTabs(source) {
  const lines = String(source || '').split('\n')
  const callables = new Map()
  const headerRe = /^\s*(Sub|Function)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/i
  for (let index = 0; index < lines.length; index += 1) {
    const match = headerRe.exec(lines[index])
    if (!match) continue
    const kind = match[1]
    const name = match[2]
    const enderRe = new RegExp(`^\\s*End\\s+${kind}\\s*$`, 'i')
    let end = lines.length - 1
    for (let next = index + 1; next < lines.length; next += 1) {
      if (enderRe.test(lines[next])) { end = next; break }
    }
    callables.set(name.toUpperCase(), { id: `sub:${name.toUpperCase()}`, label: name, startLine: index + 1, content: lines.slice(index, end + 1).join('\n') })
  }
  const mainCallable = callables.get('MAIN')
  if (mainCallable) {
    return { main: { id: 'main', label: 'MAIN', startLine: mainCallable.startLine, content: mainCallable.content }, callables }
  }
  let firstHeader = lines.findIndex((line) => headerRe.test(line))
  if (firstHeader < 0) firstHeader = lines.length
  return { main: { id: 'main', label: 'MAIN', startLine: 1, content: lines.slice(0, firstHeader).join('\n') }, callables }
}

function vbishExecutableSteps(tab, callables) {
  return tab.content.split('\n').flatMap((line, index) => {
    const lineNumber = tab.startLine + index
    if (/^\s*(Sub|Function|End\s+(Sub|Function))\b/i.test(line)) return []
    const dim = /^\s*Dim\s+([A-Za-z_][A-Za-z0-9_]*)\s+As\s+[A-Za-z_][A-Za-z0-9_]*\s*(?:=\s*(.+))?$/i.exec(line)
    if (dim) return [{ line: lineNumber, kind: 'ASSIGN', value: dim[2] ? `${dim[1]} = ${dim[2].trim()}` : `${dim[1]} declared` }]
    const call = /^\s*(?:Call\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*$/.exec(line)
    if (call) return [{ line: lineNumber, kind: 'CALL', value: call[1], target: callables.get(call[1].toUpperCase()) || null }]
    const ret = /^\s*Return\b\s*(.*)$/i.exec(line)
    if (ret) return [{ line: lineNumber, kind: 'STOP', value: ret[1]?.trim() ? `Returned ${ret[1].trim()}` : 'Sub/Function completed' }]
    const assign = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/.exec(line)
    if (assign) return [{ line: lineNumber, kind: 'ASSIGN', value: `${assign[1]} = ${assign[2].trim()}` }]
    return []
  })
}

function buildPascalishExecutionTabs(source) {
  const lines = String(source || '').split('\n')
  const callables = new Map()
  const headerRe = /^\s*(procedure|function)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/i

  function scanBlockEnd(startIndex) {
    let depth = 0
    let opened = false
    for (let next = startIndex; next < lines.length; next += 1) {
      const beginCount = (lines[next].match(/\bbegin\b/gi) || []).length
      const endCount = (lines[next].match(/\bend\b/gi) || []).length
      if (beginCount > 0) opened = true
      depth += beginCount - endCount
      if (opened && depth <= 0) return next
    }
    return lines.length - 1
  }

  for (let index = 0; index < lines.length; index += 1) {
    const match = headerRe.exec(lines[index])
    if (!match) continue
    const name = match[2]
    const end = scanBlockEnd(index)
    callables.set(name.toUpperCase(), { id: `proc:${name.toUpperCase()}`, label: name, startLine: index + 1, content: lines.slice(index, end + 1).join('\n') })
  }

  const claimedLines = new Set()
  for (const callable of callables.values()) {
    const lineCount = callable.content.split('\n').length
    for (let n = callable.startLine - 1; n < callable.startLine - 1 + lineCount; n += 1) claimedLines.add(n)
  }

  let mainStart = -1
  for (let index = 0; index < lines.length; index += 1) {
    if (claimedLines.has(index)) continue
    if (/^\s*begin\b/i.test(lines[index])) { mainStart = index; break }
  }
  if (mainStart < 0) {
    return { main: { id: 'main', label: 'MAIN', startLine: 1, content: '' }, callables }
  }
  const mainEnd = scanBlockEnd(mainStart)
  return { main: { id: 'main', label: 'MAIN', startLine: mainStart + 1, content: lines.slice(mainStart, mainEnd + 1).join('\n') }, callables }
}

const PASCALISH_NON_CALL_KEYWORDS = /^(if|while|for|repeat|with|begin|end|program|procedure|function|var|type|class)$/i

function pascalishExecutableSteps(tab, callables) {
  return tab.content.split('\n').flatMap((line, index) => {
    const lineNumber = tab.startLine + index
    const call = /^\s*(?:call\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*;?\s*$/i.exec(line)
    if (call && !PASCALISH_NON_CALL_KEYWORDS.test(call[1])) {
      const name = call[1]
      const argsText = String(call[2] || '').trim()
      if (/^(writeln|write)$/i.test(name)) {
        const literal = /^'((?:[^'\\]|\\.)*)'$/.exec(argsText)
        return [{ line: lineNumber, kind: 'DISPLAY', value: literal ? literal[1] : argsText }]
      }
      return [{ line: lineNumber, kind: 'PERFORM', value: name, target: callables.get(name.toUpperCase()) || null }]
    }
    if (/^\s*return\b/i.test(line) || /^\s*end\.\s*$/i.test(line)) {
      return [{ line: lineNumber, kind: 'STOP', value: 'Program completed' }]
    }
    return []
  })
}

export function buildExecutionTabs(languageId, source) {
  if (languageId === 'cobolish') return buildCobolishExecutionTabs(source)
  if (languageId === 'vbish') return buildVbishExecutionTabs(source)
  if (languageId === 'pascalish') return buildPascalishExecutionTabs(source)
  return { main: { id: 'main', label: 'MAIN', startLine: 1, content: String(source || '') }, callables: new Map() }
}

export function getExecutableSteps(languageId, tab, callables) {
  if (languageId === 'cobolish') return cobolishExecutableSteps(tab, callables)
  if (languageId === 'vbish') return vbishExecutableSteps(tab, callables)
  if (languageId === 'pascalish') return pascalishExecutableSteps(tab, callables)
  return []
}
