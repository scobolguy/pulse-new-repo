import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';

function parseQuoted(value) {
  const s = String(value || '').trim();
  if (s.length < 2) return null;
  const q = s[0];
  if ((q !== '"' && q !== '\'') || s[s.length - 1] !== q) return null;
  return s.slice(1, -1);
}

function stripComments(sourceText) {
  function stripLineCommentOutsideQuotes(line) {
    function startsCommentAt(index) {
      const ch = line[index];
      const next = line[index + 1];
      const isSlashComment = ch === '/' && next === '/';
      const isDashComment = ch === '-' && next === '-';
      return isSlashComment || isDashComment;
    }

    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < line.length - 1; i += 1) {
      const ch = line[i];
      const prev = i > 0 ? line[i - 1] : '';

      if (ch === '"' && !inSingle && prev !== '\\') {
        inDouble = !inDouble;
      } else if (ch === '\'' && !inDouble && prev !== '\\') {
        inSingle = !inSingle;
      }

      if (!inSingle && !inDouble && startsCommentAt(i)) {
        return line.slice(0, i);
      }
    }
    return line;
  }

  return sourceText
    .split(/\r?\n/)
    .map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) return '';
      return stripLineCommentOutsideQuotes(line);
    })
    .join('\n');
}

function parseTypesList(raw) {
  const t = String(raw || '').trim();
  if (!t.startsWith('(') || !t.endsWith(')')) return [];
  const body = t.slice(1, -1);
  return body
    .split(',')
    .map(part => parseQuoted(part.trim()))
    .filter(Boolean);
}

export function parseWorkflowDSL(sourceText) {
  const src = stripComments(sourceText);
  const lines = src
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const symbols = {
    queues: [],
    files: [],
    apis: []
  };
  const workflows = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    const queueMatch = line.match(/^QUEUE\s+("[^"]+"|'[^']+')\s*->\s*("[^"]+"|'[^']+')\s*(.*);$/i);
    if (queueMatch) {
      const symbol = parseQuoted(queueMatch[1]);
      const queueName = parseQuoted(queueMatch[2]);
      const tail = queueMatch[3] || '';

      let dataTypeIds = [];
      const typesMatch = tail.match(/\bTYPES\s*(\([^)]*\))/i);
      if (typesMatch) {
        dataTypeIds = parseTypesList(typesMatch[1]);
      } else {
        const typeMatch = tail.match(/\bTYPE\s+("[^"]+"|'[^']+')/i);
        if (typeMatch) {
          const single = parseQuoted(typeMatch[1]);
          if (single) dataTypeIds = [single];
        }
      }

      symbols.queues.push({
        symbol,
        queueName,
        dataTypeIds,
        dataTypeId: dataTypeIds[0] || null
      });
      i += 1;
      continue;
    }

    const fileMatch = line.match(/^FILE\s+("[^"]+"|'[^']+')\s*->\s*("[^"]+"|'[^']+')\s*;$/i);
    if (fileMatch) {
      symbols.files.push({
        symbol: parseQuoted(fileMatch[1]),
        path: parseQuoted(fileMatch[2])
      });
      i += 1;
      continue;
    }

    const apiMatch = line.match(/^API\s+("[^"]+"|'[^']+')\s+BASE\s+("[^"]+"|'[^']+')\s*;$/i);
    if (apiMatch) {
      symbols.apis.push({
        symbol: parseQuoted(apiMatch[1]),
        baseUrl: parseQuoted(apiMatch[2])
      });
      i += 1;
      continue;
    }

    const workflowMatch = line.match(/^WORKFLOW\s+("[^"]+"|'[^']+')\s+BEGIN$/i);
    if (workflowMatch) {
      const workflowName = parseQuoted(workflowMatch[1]);
      const steps = [];
      i += 1;

      while (i < lines.length && !/^END;$/i.test(lines[i])) {
        const stepLine = lines[i];
        const stepMatch = stepLine.match(/^STEP\s+("[^"]+"|'[^']+')\s+CALL\s+API\s+("[^"]+"|'[^']+')\s+(GET|POST|PUT|PATCH|DELETE)\s+("[^"]+"|'[^']+')\s*;$/i);
        if (!stepMatch) {
          throw new Error(`Invalid workflow step: ${stepLine}`);
        }
        steps.push({
          id: parseQuoted(stepMatch[1]),
          action: 'call_api',
          apiSymbol: parseQuoted(stepMatch[2]),
          method: stepMatch[3].toUpperCase(),
          route: parseQuoted(stepMatch[4])
        });
        i += 1;
      }

      if (i >= lines.length || !/^END;$/i.test(lines[i])) {
        throw new Error(`Workflow ${workflowName} is missing END;`);
      }

      workflows.push({
        id: workflowName,
        steps
      });
      i += 1;
      continue;
    }

    throw new Error(`Unrecognized DSL line: ${line}`);
  }

  return { symbols, workflows };
}

export function compileWorkflowDSL(sourceText) {
  const parsed = parseWorkflowDSL(sourceText);
  const compiledAt = new Date().toISOString();

  return {
    version: 1,
    compiledAt,
    symbols: parsed.symbols,
    workflows: parsed.workflows
  };
}

function parseArgs(argv) {
  const args = {
    in: './data/workflow.wfl',
    symbolsOut: './data/symbols.generated.json',
    workflowOut: './data/workflows.generated.json',
    artifactOut: './data/workflow-compiled.json'
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--in') args.in = argv[i + 1];
    if (token === '--symbols-out') args.symbolsOut = argv[i + 1];
    if (token === '--workflow-out') args.workflowOut = argv[i + 1];
    if (token === '--artifact-out') args.artifactOut = argv[i + 1];
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(args.in);
  const sourceText = await fs.readFile(inputPath, 'utf-8');
  const compiled = compileWorkflowDSL(sourceText);

  const symbolsOutPath = path.resolve(args.symbolsOut);
  const workflowOutPath = path.resolve(args.workflowOut);
  const artifactOutPath = path.resolve(args.artifactOut);

  await fs.mkdir(path.dirname(symbolsOutPath), { recursive: true });
  await fs.mkdir(path.dirname(workflowOutPath), { recursive: true });
  await fs.mkdir(path.dirname(artifactOutPath), { recursive: true });

  await fs.writeFile(symbolsOutPath, `${JSON.stringify(compiled.symbols, null, 2)}\n`, 'utf-8');
  await fs.writeFile(workflowOutPath, `${JSON.stringify(compiled.workflows, null, 2)}\n`, 'utf-8');
  await fs.writeFile(artifactOutPath, `${JSON.stringify(compiled, null, 2)}\n`, 'utf-8');

  console.log(`[WORKFLOW-COMPILER] Input: ${path.relative(process.cwd(), inputPath)}`);
  console.log(`[WORKFLOW-COMPILER] Symbols: ${path.relative(process.cwd(), symbolsOutPath)}`);
  console.log(`[WORKFLOW-COMPILER] Workflows: ${path.relative(process.cwd(), workflowOutPath)}`);
  console.log(`[WORKFLOW-COMPILER] Full artifact: ${path.relative(process.cwd(), artifactOutPath)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('[WORKFLOW-COMPILER] Failed:', err.message);
    process.exitCode = 1;
  });
}
