'use strict'

// Reads and edits the FLOW block of a WFL document for the Visual Flow designer.
// Mirrors the flowDecl rules in languages/wfl/grammar/WorkflowDsl.g4; everything
// outside the edited FLOW block is preserved byte-for-byte.

const DEFAULT_ANIMATION = Object.freeze({ mode: 'none', target: 'workflow', useMermaidPreview: true })

const DIRECTIVES = Object.freeze({
  name: { key: 'name', section: 'metadata', field: 'name' },
  description: { key: 'description', section: 'metadata', field: 'description' },
  createdby: { key: 'createdBy', section: 'metadata', field: 'createdBy' },
  animation: { key: 'animation', section: 'animation', field: 'mode' },
  animationtarget: { key: 'animationTarget', section: 'animation', field: 'target' },
  mermaidpreview: { key: 'mermaidPreview', section: 'animation', field: 'useMermaidPreview' },
})

const SECTION_ORDER = ['directive', 'seed', 'node', 'link']
const DIRECTIVE_KEYWORDS = new Set(['DESCRIPTION', 'TYPE', 'LABEL', 'MODE', 'TARGET', 'SOURCE', 'KIND'])
const NODE_CLAUSES = new Set(['KIND', 'TYPE', 'LABEL', 'CATALOG', 'SOURCE', 'AT', 'TARGET', 'IP', 'SERVICES', 'VIA'])

function tokenize(text) {
  const tokens = []
  const errors = []
  let index = 0
  while (index < text.length) {
    const char = text[index]
    if (/\s/.test(char)) {
      index += 1
      continue
    }
    if (char === '#' || text.startsWith('//', index) || text.startsWith('--', index)) {
      while (index < text.length && text[index] !== '\n' && text[index] !== '\r') index += 1
      continue
    }
    const start = index
    if (char === '"' || char === '\'') {
      index += 1
      let closed = false
      while (index < text.length && text[index] !== '\n' && text[index] !== '\r') {
        if (text[index] === '\\') {
          index += 2
          continue
        }
        if (text[index] === char) {
          index += 1
          closed = true
          break
        }
        index += 1
      }
      if (!closed) errors.push({ message: 'Unterminated string literal.', offset: start })
      tokens.push({ kind: 'string', text: text.slice(start, index), value: unquote(text.slice(start, index)), start, end: index })
      continue
    }
    if (/[0-9]/.test(char)) {
      while (index < text.length && /[0-9]/.test(text[index])) index += 1
      tokens.push({ kind: 'number', text: text.slice(start, index), start, end: index })
      continue
    }
    if (/[A-Za-z_]/.test(char)) {
      while (index < text.length && /[A-Za-z0-9_-]/.test(text[index])) index += 1
      const word = text.slice(start, index)
      tokens.push({ kind: 'word', text: word, upper: word.toUpperCase(), start, end: index })
      continue
    }
    const punct = text.startsWith('->', index) ? '->' : char
    index += punct.length
    tokens.push({ kind: 'punct', text: punct, start, end: index })
  }
  return { tokens, errors }
}

function unquote(raw) {
  const quote = raw[0]
  const body = raw.length >= 2 && raw[raw.length - 1] === quote ? raw.slice(1, -1) : raw.slice(1)
  return body.replace(/\\(["'\\nrt])/g, (_, character) => ({ n: '\n', r: '\r', t: '\t' }[character] ?? character))
}

function quote(value) {
  return `"${String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')}"`
}

function isWord(token, upper) {
  return token?.kind === 'word' && token.upper === upper
}

function isPunct(token, text) {
  return token?.kind === 'punct' && token.text === text
}

function splitTopLevelItems(tokens) {
  const items = []
  let depth = 0
  let startIndex = 0
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (isWord(token, 'BEGIN') || isWord(token, 'IF')) depth += 1
    else if (isWord(token, 'END') || isWord(token, 'COEND') || isWord(token, 'ENDIF')) depth = Math.max(0, depth - 1)
    else if (isPunct(token, ';') && depth === 0) {
      items.push({ startIndex, endIndex: index })
      startIndex = index + 1
    }
  }
  if (startIndex < tokens.length) items.push({ startIndex, endIndex: tokens.length - 1, unterminated: true })
  return items
}

function describeItem(tokens, item) {
  const first = tokens[item.startIndex]
  const second = tokens[item.startIndex + 1]
  const keyword = first?.kind === 'word' ? first.upper : first?.text || ''
  const name = second?.kind === 'string' ? second.value : second?.kind === 'word' ? second.upper : ''
  return { keyword, name, start: first.start, end: tokens[item.endIndex].end }
}

class FlowParseError extends Error {
  constructor(message, offset) {
    super(message)
    this.offset = offset
  }
}

class Cursor {
  constructor(tokens, index, endIndex) {
    this.tokens = tokens
    this.index = index
    this.endIndex = endIndex
  }

  peek(offset = 0) {
    const index = this.index + offset
    return index <= this.endIndex ? this.tokens[index] : undefined
  }

  next() {
    const token = this.peek()
    if (!token) throw new FlowParseError('Unexpected end of FLOW block.', this.tokens[this.endIndex]?.end ?? 0)
    this.index += 1
    return token
  }

  fail(message) {
    const token = this.peek()
    throw new FlowParseError(token ? `${message} (found '${token.text}')` : message, token?.start ?? this.tokens[this.endIndex]?.end ?? 0)
  }

  word(upper) {
    if (!isWord(this.peek(), upper)) this.fail(`Expected ${upper}`)
    return this.next()
  }

  punct(text) {
    if (!isPunct(this.peek(), text)) this.fail(`Expected '${text}'`)
    return this.next()
  }

  string() {
    if (this.peek()?.kind !== 'string') this.fail('Expected a quoted string')
    return this.next().value
  }

  signedNumber() {
    const negative = isPunct(this.peek(), '-')
    if (negative) this.next()
    if (this.peek()?.kind !== 'number') this.fail('Expected a number')
    const value = Number(this.next().text)
    return negative ? -value : value
  }
}

function createFlowModel(flowId) {
  return {
    id: flowId,
    schemaVersion: 1,
    kind: 'visual-flow-language',
    metadata: { name: flowId },
    catalog: { seedObjects: [] },
    animation: { ...DEFAULT_ANIMATION },
    nodes: [],
    edges: [],
  }
}

function directiveSpec(key) {
  return DIRECTIVES[String(key).toLowerCase()] || { key, section: 'metadata', field: key }
}

function parseDirective(cursor) {
  cursor.punct('@')
  const keyToken = cursor.peek()
  if (keyToken?.kind !== 'word' || (!DIRECTIVE_KEYWORDS.has(keyToken.upper) && isReservedWord(keyToken.upper))) {
    cursor.fail('Expected a directive name')
  }
  cursor.next()
  let value
  const token = cursor.peek()
  if (token?.kind === 'string') value = cursor.string()
  else if (isWord(token, 'TRUE') || isWord(token, 'FALSE')) value = cursor.next().upper === 'TRUE'
  else value = cursor.signedNumber()
  return { key: keyToken.text, value }
}

function parseNode(cursor, statement) {
  cursor.word('NODE')
  const node = { id: cursor.string() }
  let target = null
  let transport = null
  while (!isPunct(cursor.peek(), ';')) {
    const clause = cursor.peek()
    if (clause?.kind !== 'word' || !NODE_CLAUSES.has(clause.upper)) cursor.fail('Expected a NODE clause or \';\'')
    cursor.next()
    switch (clause.upper) {
      case 'KIND': node.kind = cursor.string(); break
      case 'TYPE': node.type = cursor.string(); break
      case 'LABEL': node.label = cursor.string(); break
      case 'CATALOG': node.sourceCatalogId = cursor.string(); break
      case 'SOURCE': node.paletteSource = cursor.string(); break
      case 'AT': {
        const atStart = clause.start
        node.x = cursor.signedNumber()
        cursor.punct(',')
        node.y = cursor.signedNumber()
        statement.atRange = { start: atStart, end: cursor.tokens[cursor.index - 1].end }
        break
      }
      case 'TARGET': target = { ...(target || {}), nodeId: cursor.string() }; break
      case 'IP': target = { ...(target || {}), ip: cursor.string() }; break
      case 'SERVICES': {
        cursor.punct('(')
        const services = []
        if (!isPunct(cursor.peek(), ')')) {
          services.push(cursor.string())
          while (isPunct(cursor.peek(), ',')) {
            cursor.next()
            services.push(cursor.string())
          }
        }
        cursor.punct(')')
        target = { ...(target || {}), services }
        break
      }
      case 'VIA': transport = cursor.string(); break
      default: break
    }
  }
  if (target) {
    node.target = { nodeId: target.nodeId || '', ip: target.ip || '', services: target.services || [] }
    if (transport) node.targetBinding = makeTargetBinding(node.target, transport)
  } else if (transport) {
    throw new FlowParseError(`NODE '${node.id}' uses VIA without a TARGET.`, statement.start)
  }
  return node
}

function makeTargetBinding(target, transport) {
  return {
    bindingType: 'topology-target',
    preferredTransport: transport,
    targetRef: target.nodeId,
    serviceCandidates: target.services,
  }
}

function parseLink(cursor) {
  cursor.word('LINK')
  const from = cursor.string()
  cursor.word('TO')
  const to = cursor.string()
  cursor.word('VIA')
  const type = cursor.string()
  let label = type
  if (isWord(cursor.peek(), 'LABEL')) {
    cursor.next()
    label = cursor.string()
  }
  return { id: edgeKey({ from, to, type }), from, to, type, label }
}

function edgeKey(edge) {
  return `${edge.from}->${edge.to}:${edge.type}`
}

const RESERVED = new Set([
  'QUEUE', 'DATABASE', 'MANAGER', 'CONNECTION', 'MODE', 'SYSTEM', 'OF', 'VISIBILITY', 'INTERNAL', 'EXPOSED', 'FILE', 'API', 'BASE',
  'WORKFLOW', 'BEGIN', 'END', 'STEP', 'CALL', 'ROUTE', 'SET', 'STATE', 'WAIT', 'CHECK', 'EXPECT', 'RETRIES', 'EVERY', 'ISSUE', 'CREATE',
  'TITLE', 'DESCRIPTION', 'PRIORITY', 'ASSIGN', 'USER', 'REPORTER', 'TYPE', 'TYPES', 'INTO', 'TESTCASE', 'TESTPLAN', 'PLAN', 'LINK', 'TO',
  'ADD', 'PROJECT', 'RELEASE', 'FOR', 'DEPLOYMENT', 'DEPLOY', 'ARTIFACT', 'CLUSTER', 'NODES', 'LABEL', 'GENERIC_SYSTEM', 'PORT', 'INPUT',
  'OUTPUT', 'CONNECT', 'FROM', 'REMOVE', 'LOCATION', 'PROJECTPLAN', 'MILESTONE', 'DUE', 'DATE', 'TASK', 'SYNCHPOINT', 'DELIVERABLE',
  'RESOURCE', 'COBEGIN', 'COEND', 'SUBFLOW', 'SYNC', 'ASYNC', 'ON', 'ERROR', 'BACKOUT', 'TRY', 'CATCH', 'ENDTRY', 'IF', 'FIELD', 'EQUALS',
  'CONTAINS', 'THEN', 'ELSE', 'ENDIF', 'SERVICE', 'PROGRAM', 'DAEMON', 'PERSISTENT', 'MIN_INSTANCES', 'MAX_INSTANCES', 'IDLE_TIMEOUT',
  'MS', 'S', 'M', 'TARGETS', 'STARTUP', 'TRUE', 'FALSE', 'FLOW', 'SEED', 'NODE', 'KIND', 'CATALOG', 'SOURCE', 'AT', 'TARGET', 'IP',
  'SERVICES', 'VIA', 'LET', 'DEFAULT', 'ENVIRONMENT', 'ENV', 'ELSIF', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'MATCHES', 'STARTS', 'ENDS',
  'WITH', 'LOWER', 'UPPER',
])

function isReservedWord(upper) {
  return RESERVED.has(upper)
}

function parseFlowItem(tokens, item) {
  const cursor = new Cursor(tokens, item.startIndex, item.endIndex)
  cursor.word('FLOW')
  const flow = createFlowModel(cursor.string())
  const beginToken = cursor.word('BEGIN')
  const statements = []
  const nodeIds = new Set()
  const edgeIds = new Set()
  while (!isWord(cursor.peek(), 'END')) {
    const first = cursor.peek()
    if (!first) cursor.fail('Expected END')
    const statement = { start: first.start, end: first.end }
    if (isPunct(first, '@')) {
      const directive = parseDirective(cursor)
      const spec = directiveSpec(directive.key)
      flow[spec.section][spec.field] = directive.value
      Object.assign(statement, { kind: 'directive', key: spec.key.toLowerCase(), directive })
    } else if (isWord(first, 'SEED')) {
      cursor.next()
      const seed = cursor.string()
      if (!flow.catalog.seedObjects.includes(seed)) flow.catalog.seedObjects.push(seed)
      Object.assign(statement, { kind: 'seed', key: seed })
    } else if (isWord(first, 'NODE')) {
      const node = parseNode(cursor, statement)
      if (nodeIds.has(node.id)) throw new FlowParseError(`NODE '${node.id}' is declared more than once.`, first.start)
      nodeIds.add(node.id)
      flow.nodes.push(node)
      Object.assign(statement, { kind: 'node', key: node.id, node })
    } else if (isWord(first, 'LINK')) {
      const edge = parseLink(cursor)
      if (edgeIds.has(edge.id)) throw new FlowParseError(`LINK '${edge.from}' TO '${edge.to}' VIA '${edge.type}' is declared more than once.`, first.start)
      edgeIds.add(edge.id)
      flow.edges.push(edge)
      Object.assign(statement, { kind: 'link', key: edge.id, edge })
    } else {
      cursor.fail('Expected @directive, SEED, NODE, LINK or END')
    }
    statement.end = cursor.punct(';').end
    statements.push(statement)
  }
  const endToken = cursor.word('END')
  cursor.punct(';')
  if (cursor.peek()) cursor.fail('Unexpected tokens after FLOW block')
  for (const edge of flow.edges) {
    for (const endpoint of [edge.from, edge.to]) {
      if (!nodeIds.has(endpoint)) {
        const statement = statements.find(entry => entry.kind === 'link' && entry.key === edge.id)
        throw new FlowParseError(`LINK references unknown NODE '${endpoint}'.`, statement?.start ?? beginToken.start)
      }
    }
  }
  return { flow, statements, beginEnd: beginToken.end, endStart: endToken.start }
}

/**
 * Parse a WFL document, returning the first FLOW block as a Visual Flow model.
 * `otherItems` lists every top-level item the designer does not edit.
 */
function parseWflFlowDocument(text, options = {}) {
  const source = String(text ?? '')
  const { tokens, errors } = tokenize(source)
  const diagnostics = [...errors]
  const items = splitTopLevelItems(tokens)
  const otherItems = []
  let flowItem = null
  for (const item of items) {
    const described = describeItem(tokens, item)
    if (!flowItem && described.keyword === 'FLOW') {
      flowItem = { ...item, ...described }
      continue
    }
    if (item.unterminated) diagnostics.push({ message: `Top-level ${described.keyword || 'item'} is missing a terminating ';'.`, offset: described.start })
    otherItems.push(described)
  }

  const result = {
    hasFlow: Boolean(flowItem),
    flowValid: !flowItem,
    flow: null,
    flowRange: flowItem ? { start: flowItem.start, end: flowItem.end } : null,
    statements: [],
    beginEnd: null,
    endStart: null,
    otherItems,
    diagnostics,
  }
  if (!flowItem) {
    result.flow = createFlowModel(options.defaultFlowId || 'flow')
    return result
  }
  try {
    Object.assign(result, parseFlowItem(tokens, flowItem), { flowValid: true })
  } catch (error) {
    if (!(error instanceof FlowParseError)) throw error
    diagnostics.push({ message: error.message, offset: error.offset })
  }
  return result
}

function normalizeNode(node) {
  const normalized = { id: String(node.id) }
  for (const field of ['kind', 'type', 'label', 'sourceCatalogId', 'paletteSource']) {
    if (node[field] !== undefined && node[field] !== null && node[field] !== '') normalized[field] = String(node[field])
  }
  if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
    normalized.x = Math.round(node.x)
    normalized.y = Math.round(node.y)
  }
  if (node.target && typeof node.target === 'object') {
    normalized.target = {
      nodeId: String(node.target.nodeId ?? ''),
      ip: String(node.target.ip ?? ''),
      services: Array.isArray(node.target.services) ? node.target.services.map(String) : [],
    }
    const transport = node.targetBinding?.preferredTransport
    if (transport) normalized.targetBinding = makeTargetBinding(normalized.target, String(transport))
  }
  return normalized
}

function normalizeEdge(edge) {
  const type = String(edge.type || 'message-broker-call')
  const normalized = { from: String(edge.from), to: String(edge.to), type, label: String(edge.label ?? type) || type }
  return { id: edgeKey(normalized), ...normalized }
}

function renderNode(node) {
  const parts = [`NODE ${quote(node.id)}`]
  if (node.kind !== undefined) parts.push(`KIND ${quote(node.kind)}`)
  if (node.type !== undefined) parts.push(`TYPE ${quote(node.type)}`)
  if (node.label !== undefined) parts.push(`LABEL ${quote(node.label)}`)
  if (node.sourceCatalogId !== undefined) parts.push(`CATALOG ${quote(node.sourceCatalogId)}`)
  if (node.paletteSource !== undefined) parts.push(`SOURCE ${quote(node.paletteSource)}`)
  if (node.x !== undefined) parts.push(renderAt(node))
  if (node.target) {
    parts.push(`TARGET ${quote(node.target.nodeId)}`)
    if (node.target.ip) parts.push(`IP ${quote(node.target.ip)}`)
    if (node.target.services.length) parts.push(`SERVICES (${node.target.services.map(quote).join(', ')})`)
    if (node.targetBinding) parts.push(`VIA ${quote(node.targetBinding.preferredTransport)}`)
  }
  return `${parts.join(' ')};`
}

function renderAt(node) {
  return `AT ${node.x}, ${node.y}`
}

function renderEdge(edge) {
  const label = edge.label !== edge.type ? ` LABEL ${quote(edge.label)}` : ''
  return `LINK ${quote(edge.from)} TO ${quote(edge.to)} VIA ${quote(edge.type)}${label};`
}

function renderDirectiveValue(value) {
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number' && Number.isInteger(value)) return String(value)
  return quote(value)
}

function renderDirective(key, value) {
  return `@${key} ${renderDirectiveValue(value)};`
}

function isDirectiveKey(key) {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) && (!isReservedWord(key.toUpperCase()) || DIRECTIVE_KEYWORDS.has(key.toUpperCase()))
}

function isDirectiveValue(value) {
  return typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isInteger(value))
}

// Desired directives keyed by lower-case name; `defaults` records the value a
// directive takes when omitted, so equivalent explicit directives are kept.
function desiredDirectives(flow) {
  const desired = new Map()
  const defaults = new Map([
    ['name', flow.id],
    ['animation', DEFAULT_ANIMATION.mode],
    ['animationtarget', DEFAULT_ANIMATION.target],
    ['mermaidpreview', DEFAULT_ANIMATION.useMermaidPreview],
  ])
  const metadata = flow.metadata && typeof flow.metadata === 'object' ? flow.metadata : {}
  const animation = flow.animation && typeof flow.animation === 'object' ? flow.animation : {}
  const add = (key, value) => {
    if (!isDirectiveKey(key) || !isDirectiveValue(value)) return
    const lower = key.toLowerCase()
    if (defaults.has(lower) && defaults.get(lower) === value) return
    desired.set(lower, { key, value })
  }
  for (const [field, value] of Object.entries(metadata)) {
    const known = Object.values(DIRECTIVES).find(spec => spec.section === 'metadata' && spec.field === field)
    add(known ? known.key : field, value)
  }
  add('animation', animation.mode ?? DEFAULT_ANIMATION.mode)
  add('animationTarget', animation.target ?? DEFAULT_ANIMATION.target)
  add('mermaidPreview', animation.useMermaidPreview ?? DEFAULT_ANIMATION.useMermaidPreview)
  return { desired, defaults }
}

function renderFlowBlock(flow, indent = '  ') {
  const id = String(flow.id || flow.metadata?.name || 'flow')
  const model = { ...flow, id }
  const lines = [`FLOW ${quote(id)} BEGIN`]
  for (const { key, value } of desiredDirectives(model).desired.values()) lines.push(indent + renderDirective(key, value))
  for (const seed of seedsOf(model)) lines.push(`${indent}SEED ${quote(seed)};`)
  for (const node of nodesOf(model)) lines.push(indent + renderNode(node))
  for (const edge of edgesOf(model)) lines.push(indent + renderEdge(edge))
  lines.push('END;')
  return lines.join('\n')
}

function seedsOf(flow) {
  return Array.from(new Set((Array.isArray(flow.catalog?.seedObjects) ? flow.catalog.seedObjects : []).map(String)))
}

function nodesOf(flow) {
  const seen = new Set()
  return (Array.isArray(flow.nodes) ? flow.nodes : [])
    .filter(node => node && node.id !== undefined && node.id !== null && !seen.has(String(node.id)) && seen.add(String(node.id)))
    .map(normalizeNode)
}

function edgesOf(flow) {
  const seen = new Set()
  return (Array.isArray(flow.edges) ? flow.edges : [])
    .filter(edge => edge && edge.from !== undefined && edge.to !== undefined)
    .map(normalizeEdge)
    .filter(edge => !seen.has(edge.id) && seen.add(edge.id))
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function lineIndentAt(text, offset) {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1
  const match = /^[ \t]*/.exec(text.slice(lineStart, offset))
  return match ? match[0] : ''
}

function deletionRange(text, statement) {
  const lineStart = text.lastIndexOf('\n', statement.start - 1) + 1
  let lineEnd = text.indexOf('\n', statement.end)
  if (lineEnd === -1) lineEnd = text.length
  const before = text.slice(lineStart, statement.start)
  const after = text.slice(statement.end, lineEnd)
  if (/^[ \t]*$/.test(before) && /^[ \t\r]*$/.test(after)) {
    return { start: lineStart, end: Math.min(text.length, lineEnd + 1) }
  }
  return { start: statement.start, end: statement.end }
}

/**
 * Compute minimal text edits that make the document's FLOW block match `nextFlow`.
 * Edits use offsets into the original text and never overlap.
 */
function computeFlowEdits(text, nextFlow, options = {}) {
  const source = String(text ?? '')
  const parsed = options.parsed || parseWflFlowDocument(source, options)
  if (!parsed.flowValid) {
    throw new Error('Fix the FLOW block syntax before editing it in the designer.')
  }
  if (!parsed.hasFlow) {
    const block = renderFlowBlock({ ...nextFlow, id: nextFlow.id || options.defaultFlowId || 'flow' })
    const separator = !source.length ? '' : source.endsWith('\n\n') ? '' : source.endsWith('\n') ? '\n' : '\n\n'
    return [{ start: source.length, end: source.length, text: `${separator}${block}\n` }]
  }

  const flowId = parsed.flow.id
  const model = { ...nextFlow, id: flowId }
  const { desired, defaults } = desiredDirectives(model)
  const wanted = {
    directive: desired,
    seed: new Map(seedsOf(model).map(seed => [seed, seed])),
    node: new Map(nodesOf(model).map(node => [node.id, node])),
    link: new Map(edgesOf(model).map(edge => [edge.id, edge])),
  }

  const edits = []
  const survivors = []
  const handled = { directive: new Set(), seed: new Set(), node: new Set(), link: new Set() }
  for (const statement of parsed.statements) {
    const target = wanted[statement.kind].get(statement.key)
    if (handled[statement.kind].has(statement.key)) {
      edits.push({ ...deletionRange(source, statement), text: '' })
      continue
    }
    if (target === undefined) {
      if (statement.kind === 'directive' && defaults.has(statement.key) && sameJson(defaults.get(statement.key), statement.directive.value)) {
        handled.directive.add(statement.key)
        survivors.push(statement)
        continue
      }
      edits.push({ ...deletionRange(source, statement), text: '' })
      continue
    }
    handled[statement.kind].add(statement.key)
    survivors.push(statement)
    if (statement.kind === 'directive' && !sameJson(statement.directive.value, target.value)) {
      edits.push({ start: statement.start, end: statement.end, text: renderDirective(statement.directive.key, target.value) })
    } else if (statement.kind === 'node') {
      const current = normalizeNode(statement.node)
      if (sameJson(current, target)) continue
      const moved = { ...current, x: target.x, y: target.y }
      if (statement.atRange && target.x !== undefined && sameJson(moved, target)) {
        edits.push({ start: statement.atRange.start, end: statement.atRange.end, text: renderAt(target) })
      } else {
        edits.push({ start: statement.start, end: statement.end, text: renderNode(target) })
      }
    } else if (statement.kind === 'link' && statement.edge.label !== target.label) {
      edits.push({ start: statement.start, end: statement.end, text: renderEdge(target) })
    }
  }

  const insertions = new Map()
  const indent = parsed.statements.length ? lineIndentAt(source, parsed.statements[0].start) || '  ' : '  '
  for (const kind of SECTION_ORDER) {
    const missing = [...wanted[kind].entries()].filter(([key]) => !handled[kind].has(key))
    if (!missing.length) continue
    const rendered = missing.map(([, value]) => {
      if (kind === 'directive') return renderDirective(value.key, value.value)
      if (kind === 'seed') return `SEED ${quote(value)};`
      if (kind === 'node') return renderNode(value)
      return renderEdge(value)
    })
    const anchorKinds = SECTION_ORDER.slice(0, SECTION_ORDER.indexOf(kind) + 1).reverse()
    let anchor = null
    for (const anchorKind of anchorKinds) {
      const candidates = survivors.filter(statement => statement.kind === anchorKind)
      if (candidates.length) {
        anchor = candidates[candidates.length - 1].end
        break
      }
    }
    const offset = anchor ?? parsed.beginEnd
    const existing = insertions.get(offset) || []
    insertions.set(offset, existing.concat(rendered))
  }
  for (const [offset, lines] of insertions) {
    edits.push({ start: offset, end: offset, text: lines.map(line => `\n${indent}${line}`).join('') })
  }
  return edits.sort((left, right) => left.start - right.start || left.end - right.end)
}

function applyEdits(text, edits) {
  let result = String(text ?? '')
  for (const edit of [...edits].sort((left, right) => right.start - left.start || right.end - left.end)) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end)
  }
  return result
}

function createDefaultWflText(flowId, template = {}) {
  return `${renderFlowBlock({ ...template, id: flowId })}\n`
}

function flowIdFromFileName(fileName) {
  const base = String(fileName || '').split(/[\\/]/).pop().replace(/\.[^.]+$/, '')
  return base.replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '') || 'flow'
}

module.exports = {
  tokenize,
  parseWflFlowDocument,
  renderFlowBlock,
  computeFlowEdits,
  applyEdits,
  createDefaultWflText,
  flowIdFromFileName,
  createFlowModel,
}
