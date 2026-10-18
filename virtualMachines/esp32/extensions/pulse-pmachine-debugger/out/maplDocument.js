import { object, rulesOf } from './dataMapperModel.js';
const KEYWORDS = new Set(['map', 'from', 'to', 'end', 'default', 'using', 'if', 'then', 'else', 'for', 'each', 'as',
    'validate', 'or', 'and', 'mod', 'not', 'true', 'false']);
const KNOWN_DIRECTIVES = {
    name: 'name', description: 'description', enabled: 'enabled', sourceSchema: 'sourceSchemaPath', targetSchema: 'targetSchemaPath',
};
const DIRECTIVE_ORDER = ['name', 'description', 'enabled', 'sourceSchema', 'targetSchema'];
function position(text, offset) {
    const before = text.slice(0, offset).split(/\r?\n/);
    return `line ${before.length}:${before[before.length - 1].length + 1}`;
}
function tokenize(text) {
    const tokens = [];
    let index = 0;
    while (index < text.length) {
        const ch = text[index];
        if (/\s/.test(ch)) {
            index++;
            continue;
        }
        if (text.startsWith('//', index)) {
            while (index < text.length && text[index] !== '\n')
                index++;
            continue;
        }
        if (text.startsWith('/*', index)) {
            const close = text.indexOf('*/', index + 2);
            if (close < 0)
                throw new Error(`[MAPL] Unterminated comment at ${position(text, index)}`);
            index = close + 2;
            continue;
        }
        const start = index;
        if (ch === '"' || ch === '\'') {
            let value = '';
            index++;
            while (index < text.length && text[index] !== ch) {
                if (text[index] === '\\' && index + 1 < text.length) {
                    value += text[index + 1];
                    index += 2;
                }
                else
                    value += text[index++];
            }
            if (index >= text.length)
                throw new Error(`[MAPL] Unterminated string at ${position(text, start)}`);
            index++;
            tokens.push({ kind: 'string', text: text.slice(start, index), value, start, end: index });
        }
        else if (/[A-Za-z_]/.test(ch)) {
            while (index < text.length && /\w/.test(text[index]))
                index++;
            tokens.push({ kind: 'ident', text: text.slice(start, index), value: text.slice(start, index), start, end: index });
        }
        else if (/\d/.test(ch)) {
            while (index < text.length && /[\d.]/.test(text[index]))
                index++;
            tokens.push({ kind: 'number', text: text.slice(start, index), value: text.slice(start, index), start, end: index });
        }
        else {
            const two = text.slice(index, index + 2);
            const punct = [':=', '<=', '>=', '<>'].includes(two) ? two : ch;
            index += punct.length;
            tokens.push({ kind: 'punct', text: punct, value: punct, start, end: index });
        }
    }
    tokens.push({ kind: 'eof', text: '', value: '', start: text.length, end: text.length });
    return tokens;
}
function isKeyword(token, word) {
    return token.kind === 'ident' && token.text === word;
}
/** Parse `IDENT ('.' (IDENT | STRING))*` starting at index; returns the path and next index, or undefined. */
function readPath(tokens, index) {
    const first = tokens[index];
    if (first.kind !== 'ident' || KEYWORDS.has(first.text))
        return undefined;
    const segments = [first.value];
    let next = index + 1;
    while (tokens[next].text === '.' && tokens[next].kind === 'punct'
        && ((tokens[next + 1].kind === 'ident' && !KEYWORDS.has(tokens[next + 1].text)) || tokens[next + 1].kind === 'string')) {
        segments.push(tokens[next + 1].value);
        next += 2;
    }
    return { path: segments.join('.'), next };
}
function stripPrefix(fieldPath, prefix) {
    return fieldPath.startsWith(`${prefix}.`) ? fieldPath.slice(prefix.length + 1) : fieldPath;
}
export function parseMapl(text) {
    const tokens = tokenize(text);
    let index = 0;
    const fail = (message, token = tokens[index]) => {
        throw new Error(`[MAPL] ${position(text, token.start)} ${message}`);
    };
    const expect = (value) => {
        const token = tokens[index];
        if (token.text !== value || token.kind === 'string')
            fail(`expected '${value}' but found '${token.text || 'end of file'}'`);
        index++;
        return token;
    };
    const nameRef = (label) => {
        const token = tokens[index];
        if (token.kind === 'string' || (token.kind === 'ident' && !KEYWORDS.has(token.text))) {
            index++;
            return token.value;
        }
        return fail(`expected ${label} name`);
    };
    const mapToken = expect('map');
    const id = nameRef('map');
    expect('from');
    const sourceTypeId = nameRef('source type');
    expect('to');
    const targetTypeId = nameRef('target type');
    const header = { start: mapToken.start, end: expect(';').end };
    const directives = [];
    while (tokens[index].text === '@' && tokens[index].kind === 'punct') {
        const start = tokens[index++].start;
        const key = tokens[index];
        if (key.kind !== 'ident')
            fail('expected directive name');
        index++;
        const valueToken = tokens[index];
        let value;
        if (valueToken.kind === 'string')
            value = valueToken.value;
        else if (valueToken.kind === 'number')
            value = Number(valueToken.text);
        else if (isKeyword(valueToken, 'true') || isKeyword(valueToken, 'false'))
            value = valueToken.text === 'true';
        else
            return fail('expected a string, number, true or false directive value');
        index++;
        if (directives.some(directive => directive.key === key.text))
            fail(`duplicate directive @${key.text}`, key);
        directives.push({ key: key.text, value, start, end: expect(';').end });
    }
    const rules = [];
    const extras = [];
    while (!(isKeyword(tokens[index], 'end') && tokens[index + 1]?.text === ';')) {
        const first = tokens[index];
        if (first.kind === 'eof')
            fail('missing end; for map');
        if (first.text === '@')
            fail('directives must come before map statements');
        let last;
        if (isKeyword(first, 'if') || isKeyword(first, 'for')) {
            let depth = 0;
            for (;;) {
                const token = tokens[index];
                if (token.kind === 'eof')
                    return fail(`unterminated ${first.text} statement`, first);
                if (isKeyword(token, 'if') || isKeyword(token, 'for'))
                    depth++;
                if (isKeyword(token, 'end') && tokens[index + 1].text === ';') {
                    depth--;
                    if (depth === 0) {
                        last = tokens[index + 1];
                        index += 2;
                        break;
                    }
                }
                index++;
            }
        }
        else {
            let parens = 0;
            const statementStart = index;
            while (!(tokens[index].text === ';' && tokens[index].kind === 'punct' && parens === 0)) {
                const token = tokens[index];
                if (token.kind === 'eof' || (isKeyword(token, 'end') && parens === 0 && index !== statementStart)) {
                    return fail('expected ; after statement', token);
                }
                if (token.text === '(')
                    parens++;
                if (token.text === ')')
                    parens--;
                index++;
            }
            last = tokens[index++];
            const target = readPath(tokens, statementStart);
            const source = target && tokens[target.next].text === ':=' ? readPath(tokens, target.next + 1) : undefined;
            if (target && source) {
                let next = source.next;
                let conversionRule = '';
                if (isKeyword(tokens[next], 'using') && tokens[next + 1].kind === 'string') {
                    conversionRule = tokens[next + 1].value;
                    next += 2;
                }
                if (tokens[next] === last) {
                    rules.push({ start: first.start, end: last.end, rule: {
                            sourcePath: stripPrefix(source.path, 'source'), targetPath: stripPrefix(target.path, 'target'), conversionRule,
                        } });
                    continue;
                }
            }
        }
        extras.push({ start: first.start, end: last.end, text: text.slice(first.start, last.end) });
    }
    const bodyEnd = tokens[index].start;
    index += 2;
    if (tokens[index].kind !== 'eof')
        fail('a MAPL designer file contains exactly one map');
    return { id, sourceTypeId, targetTypeId, header, directives, rules, extras, bodyEnd };
}
function inferStructure(paths) {
    const root = { children: [] };
    for (const fieldPath of paths) {
        let node = root;
        const segments = fieldPath.split('.');
        segments.forEach((name, depth) => {
            const children = node.children;
            let child = children.find(item => item.name === name);
            if (!child) {
                child = depth === segments.length - 1 ? { name, kind: 'leaf', valueType: 'unknown' }
                    : { name, kind: 'branch', valueType: 'object', children: [] };
                children.push(child);
            }
            else if (depth < segments.length - 1 && !Array.isArray(child.children)) {
                Object.assign(child, { kind: 'branch', valueType: 'object', children: [] });
            }
            node = child;
        });
    }
    return root;
}
/** Project a MAPL document onto the designer model, using cached Librarian structures where available. */
export function maplToMapping(text, structures = {}) {
    const parsed = parseMapl(text);
    const directive = (key) => parsed.directives.find(item => item.key === key)?.value;
    const map = {
        id: parsed.id,
        name: String(directive('name') ?? parsed.id),
        description: String(directive('description') ?? ''),
        enabled: directive('enabled') !== false,
        sourceTypeId: parsed.sourceTypeId,
        targetTypeId: parsed.targetTypeId,
        sourceSchemaPath: String(directive('sourceSchema') ?? ''),
        targetSchemaPath: String(directive('targetSchema') ?? ''),
        rules: parsed.rules.map(statement => ({ ...statement.rule })),
        submaps: [],
        extras: parsed.extras.map(extra => extra.text),
    };
    for (const side of ['source', 'target']) {
        const cached = structures[String(map[`${side}SchemaPath`])];
        map[`${side}Structure`] = cached?.structure
            ?? inferStructure(rulesOf(map).map(rule => (side === 'source' ? rule.sourcePath : rule.targetPath)));
        map[`${side}StructureInferred`] = !cached?.structure;
        if (cached?.mtime)
            map[`${side}SchemaMtime`] = cached.mtime;
    }
    const fieldInfo = (side, fieldPath) => {
        let nodes = map[`${side}Structure`].children;
        let found;
        for (const name of fieldPath.split('.')) {
            found = Array.isArray(nodes) ? nodes.find((node) => object(node) && node.name === name) : undefined;
            nodes = found?.children;
        }
        return { kind: found?.kind === 'branch' ? 'branch' : 'leaf', valueType: typeof found?.valueType === 'string' ? found.valueType : 'unknown' };
    };
    map.rules = rulesOf(map).map(rule => {
        const source = fieldInfo('source', rule.sourcePath);
        const target = fieldInfo('target', rule.targetPath);
        return { ...rule, kind: source.kind, sourceValueType: source.valueType, targetValueType: target.valueType };
    });
    return map;
}
function quoteString(value) {
    return `'${value.replaceAll('\\', '\\\\').replaceAll('\'', '\\\'')}'`;
}
function plainIdent(value) {
    return /^[A-Za-z_]\w*$/.test(value) && !KEYWORDS.has(value);
}
export function formatName(value) {
    return plainIdent(value) ? value : quoteString(value);
}
export function formatPath(prefix, fieldPath) {
    const segments = fieldPath.split('.').filter(Boolean);
    if (!segments.length)
        throw new Error(`Empty ${prefix} field path.`);
    return [prefix, ...segments.map(segment => (plainIdent(segment) ? segment : quoteString(segment)))].join('.');
}
export function formatRule(rule) {
    const conversion = typeof rule.conversionRule === 'string' && rule.conversionRule.trim()
        ? ` using ${quoteString(rule.conversionRule)}` : '';
    return `${formatPath('target', rule.targetPath)} := ${formatPath('source', rule.sourcePath)}${conversion};`;
}
function formatDirectiveValue(value) {
    return typeof value === 'string' ? quoteString(value) : String(value);
}
function directiveValues(map) {
    const text = (value) => (typeof value === 'string' && value.length ? value : undefined);
    return {
        name: text(map.name) !== undefined && map.name !== map.id ? String(map.name) : undefined,
        description: text(map.description),
        enabled: map.enabled === false ? false : undefined,
        sourceSchema: text(map.sourceSchemaPath),
        targetSchema: text(map.targetSchemaPath),
    };
}
function formatHeader(map) {
    const required = (key) => {
        const value = String(map[key] ?? '').trim();
        if (!value)
            throw new Error(`MAPL maps need a ${key}.`);
        return value;
    };
    return `map ${formatName(required('id'))} from ${formatName(required('sourceTypeId'))} to ${formatName(required('targetTypeId'))};`;
}
/** Render a complete MAPL file for a designer mapping (new files, imports and conversions). */
export function mappingToMapl(map) {
    const values = directiveValues(map);
    const lines = [formatHeader(map)];
    for (const key of DIRECTIVE_ORDER) {
        if (values[key] !== undefined)
            lines.push(`  @${key} ${formatDirectiveValue(values[key])};`);
    }
    for (const rule of rulesOf(map))
        lines.push(`  ${formatRule(rule)}`);
    lines.push('end;', '');
    return lines.join('\n');
}
function lineSpan(text, span) {
    let start = span.start;
    while (start > 0 && (text[start - 1] === ' ' || text[start - 1] === '\t'))
        start--;
    let end = span.end;
    while (end < text.length && (text[end] === ' ' || text[end] === '\t'))
        end++;
    const wholeLine = (start === 0 || text[start - 1] === '\n') && (end === text.length || text[end] === '\r' || text[end] === '\n');
    if (!wholeLine)
        return span;
    if (text[end] === '\r')
        end++;
    if (text[end] === '\n')
        end++;
    return { start, end };
}
function lineStart(text, offset) {
    const index = text.lastIndexOf('\n', offset - 1);
    return index + 1;
}
/**
 * Compute minimal text splices that make the MAPL text express the designer mapping.
 * Comments, untouched rules and preserved statements keep their original text.
 */
export function maplSplices(text, map) {
    const parsed = parseMapl(text);
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const splices = [];
    const header = formatHeader(map);
    if (parsed.id !== map.id || parsed.sourceTypeId !== map.sourceTypeId || parsed.targetTypeId !== map.targetTypeId) {
        splices.push({ ...parsed.header, text: header });
    }
    const values = directiveValues(map);
    const inserts = [];
    for (const key of DIRECTIVE_ORDER) {
        const existing = parsed.directives.find(directive => directive.key === key);
        const value = values[key];
        if (existing && value === undefined)
            splices.push({ ...lineSpan(text, existing), text: '' });
        else if (existing && value !== existing.value)
            splices.push({ ...existing, text: `@${key} ${formatDirectiveValue(value)};` });
        else if (!existing && value !== undefined)
            inserts.push(`  @${key} ${formatDirectiveValue(value)};${eol}`);
    }
    if (inserts.length) {
        const anchor = parsed.directives.length ? parsed.directives[parsed.directives.length - 1].end : parsed.header.end;
        splices.push({ start: anchor, end: anchor, text: `${eol}${inserts.join('').replace(new RegExp(`${eol}$`), '')}` });
    }
    const before = parsed.rules;
    const after = rulesOf(map);
    const same = (left, right) => left.sourcePath === right.sourcePath
        && left.targetPath === right.targetPath && (left.conversionRule ?? '') === (right.conversionRule ?? '');
    let removed = -1;
    if (after.length === before.length - 1) {
        removed = before.findIndex((statement, index) => index >= after.length || !same(statement.rule, after[index]));
        if (!after.slice(removed).every((rule, index) => same(before[removed + index + 1].rule, rule)))
            removed = -1;
    }
    if (removed >= 0) {
        splices.push({ ...lineSpan(text, before[removed]), text: '' });
    }
    else {
        before.forEach((statement, index) => {
            if (index >= after.length)
                splices.push({ ...lineSpan(text, statement), text: '' });
            else if (!same(statement.rule, after[index]))
                splices.push({ ...statement, text: formatRule(after[index]) });
        });
        if (after.length > before.length) {
            const insertAt = lineStart(text, parsed.bodyEnd);
            const atLineStart = text.slice(insertAt, parsed.bodyEnd).trim() === '';
            const added = after.slice(before.length).map(rule => `  ${formatRule(rule)}${eol}`).join('');
            splices.push(atLineStart ? { start: insertAt, end: insertAt, text: added }
                : { start: parsed.bodyEnd, end: parsed.bodyEnd, text: `${eol}${added}` });
        }
    }
    return splices.sort((left, right) => right.start - left.start);
}
export function applySplices(text, splices) {
    return [...splices].sort((left, right) => right.start - left.start)
        .reduce((result, splice) => result.slice(0, splice.start) + splice.text + result.slice(splice.end), text);
}
//# sourceMappingURL=maplDocument.js.map