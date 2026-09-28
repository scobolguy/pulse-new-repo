import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';

function cleanLine(line) {
  return String(line || '').replace(/#.*/, '').trim();
}

function identifier(value, fallback = 'solution') {
  const normalized = String(value || '').trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function quotedOrToken(value) {
  const text = String(value || '').trim();
  return text.replace(/^"|"$/g, '').trim();
}

function loadConversionDefinition(conversion) {
  if (!conversion?.map) return null;
  const candidates = [
    path.resolve('aggregator/data/data-maps', `${conversion.map}.map`),
    path.resolve('aggregator/data/data-maps', `${conversion.map.replaceAll('_', '-')}.map`)
  ];
  for (const candidate of candidates) {
    if (fsSync.existsSync(candidate)) return JSON.parse(fsSync.readFileSync(candidate, 'utf8'));
  }
  return null;
}

export function parseSolutionDsl(sourceText) {
  const lines = String(sourceText || '').split(/\r?\n/).map(cleanLine).filter(Boolean);
  const solution = { version: 1, id: '', problem: '', systems: [], databases: [], queues: [], services: [], conversions: [], daemons: [], methods: [] };
  let currentMethod = null;

  for (const line of lines) {
    if (currentMethod) {
      if (/^end\s*;?$/i.test(line)) {
        solution.methods.push(currentMethod);
        currentMethod = null;
        continue;
      }
      const step = line.replace(/^steps?\s+/i, '').replace(/;$/, '').trim();
      if (step && !/^steps?$/i.test(step)) currentMethod.steps.push(step);
      continue;
    }

    let match = line.match(/^solution\s+([A-Za-z_][\w-]*)\s*;?$/i);
    if (match) { solution.id = match[1]; continue; }
    match = line.match(/^problem\s+(.+?)\s*;?$/i);
    if (match) { solution.problem = quotedOrToken(match[1]); continue; }
    match = line.match(/^system\s+([A-Za-z_][\w-]*)\s*;?$/i);
    if (match) { solution.systems.push({ id: match[1] }); continue; }
    match = line.match(/^database\s+([A-Za-z_][\w-]*)\s+provider\s+([A-Za-z_][\w-]*)\s+table\s+([A-Za-z_][\w-]*)(?:\s+manager\s+([A-Za-z_][\w-]*))?(?:\s+physical\s+"?([^";]+)"?)?\s*;?$/i);
    if (match) { solution.databases.push({ id: match[1], provider: match[2], table: match[3], manager: match[4] || 'db-default', physical: (match[5] || match[3]).trim() }); continue; }
    match = line.match(/^queue\s+([A-Za-z_][\w-]*)\s+type\s+([A-Za-z_][\w.-]*)\s+direction\s+(input|output)(?:\s+manager\s+([A-Za-z_][\w-]*))?(?:\s+physical\s+"?([^";]+)"?)?\s*;?$/i);
    if (match) { solution.queues.push({ id: match[1], type: match[2], direction: match[3].toLowerCase(), manager: match[4] || 'qm-default', physical: (match[5] || `${match[2].toLowerCase()}.${match[3].toLowerCase()}`).trim() }); continue; }
    match = line.match(/^service\s+([A-Za-z_][\w-]*)\s*;?$/i);
    if (match) { solution.services.push({ id: match[1] }); continue; }
    match = line.match(/^conversion\s+([A-Za-z_][\w-]*)\s+input\s+([\w.-]+)\s+output\s+([\w.-]+)\s+map\s+"?([^";]+)"?\s*;?$/i);
    if (match) { solution.conversions.push({ id: match[1], input: match[2], output: match[3], map: match[4].trim() }); continue; }
    match = line.match(/^daemon\s+([A-Za-z_][\w-]*)\s+refresh\s+(\d+)\s+(ms|s|m)\s+reads\s+(\w+)\s+writes\s+(\w+)\s+uses\s+(\w+)\s+emits\s+(\w+)\s*;?$/i);
    if (match) {
      solution.daemons.push({ id: match[1], refresh: Number(match[2]), unit: match[3].toLowerCase(), reads: match[4], writes: match[5], uses: match[6], emits: match[7] });
      continue;
    }
    match = line.match(/^method\s+([A-Za-z_][\w-]*)\s*\(([^)]*)\)\s*(?::\s*([\w.-]+))?\s*$/i);
    if (match) {
      currentMethod = { id: match[1], parameters: match[2].trim(), outputType: match[3] || null, steps: [] };
      continue;
    }
    if (/^(steps?|begin)$/i.test(line)) continue;
    throw new Error(`Unknown solution DSL line: ${line}`);
  }

  if (currentMethod) throw new Error(`Unclosed method: ${currentMethod.id}`);
  if (!solution.id) throw new Error('Solution must declare an id');
  if (solution.daemons.length === 0) throw new Error('Solution must declare at least one daemon');
  return solution;
}

function renderPascalish(solution) {
  const daemon = solution.daemons[0];
  const refreshUnit = daemon.unit === 'm' ? 'm' : daemon.unit === 'ms' ? 'ms' : 's';
  const method = solution.methods[0];
  const input = solution.queues.find(queue => queue.id === daemon.reads);
  const output = solution.queues.find(queue => queue.id === daemon.emits);
  const database = solution.databases.find(item => item.id === daemon.writes);
  const conversion = solution.conversions[0];
  const conversionDefinition = loadConversionDefinition(conversion);
  const inputType = conversionDefinition?.sourceTypeId || conversion?.input || input?.type || 'Message';
  const outputType = conversionDefinition?.targetTypeId || conversion?.output || output?.type || 'Message';
  const serviceId = daemon.uses || conversion?.id || 'ConversionService';
  const supportedSteps = new Set(['validate', 'persist', 'convert', 'emit']);
  const loweredSteps = (method?.steps || []).map(step => {
    const normalized = step.toLowerCase();
    if (normalized.startsWith('validate ')) return 'validate';
    if (normalized.startsWith('persist ')) return 'persist';
    if (normalized.startsWith('convert ')) return 'convert';
    if (normalized.startsWith('emit ')) return 'emit';
    throw new Error(`Unsupported solution method step: ${step}`);
  });
  for (const step of loweredSteps) {
    if (!supportedSteps.has(step)) throw new Error(`Unsupported solution method step: ${step}`);
  }
  return [
    database ? `type ${database.id}Record = record reference: string; payload: string; status: string; end;` : '',
    database ? `database ${database.id} type ${database.id}Record;` : '',
    database ? `table ${database.table} of ${database.id}Record in ${database.id} columns (reference: string, payload: string, status: string);` : '',
    `library "${inputType}" from librarian;`,
    `library "${outputType}" from librarian;`,
    `queue ${daemon.reads} queue<${inputType}>;`,
    `queue ${daemon.emits} queue<${outputType}>;`,
    `var message: ${inputType} from librarian;`,
    `var converted: ${outputType} from librarian;`,
    conversion ? `service "${serviceId}";` : '',
    conversion ? `  mapper "${conversion.id}" source "${inputType}" target "${outputType}" begin` : '',
    ...(conversion ? (conversionDefinition?.rules || [{ sourcePath: 'message', targetPath: 'message' }]).map(rule => {
      const ruleText = String(rule.conversionRule || 'output := src;').replaceAll('"', "'");
      return `  map "${rule.sourcePath}" to "${rule.targetPath}" using "${ruleText}";`;
    }) : []),
    conversion ? '  end;' : '',
    conversion ? `  get "/convert" accepts ${inputType} returns ${outputType};` : '',
    conversion ? '  begin' : '',
    conversion ? `    return map("${conversion.id}", src);` : '',
    conversion ? '  end;' : '',
    conversion ? 'end.' : '',
    `daemon "${daemon.id}" refresh ${daemon.refresh} ${refreshUnit};`,
    'begin',
    `  dequeue ${daemon.reads} into message;`,
    `  if message <> '' then`,
    '  begin',
    database ? `    insert into ${database.table} (reference, payload, status) values (message, message, "received");` : '',
    conversion ? `    send service "${serviceId}" with message timeout 30 s reply into converted;` : '',
    conversion ? `    enqueue ${daemon.emits} with converted;` : '',
    '  end;',
    'end.'
  ].filter(line => line !== '').join('\n');
}

function renderWfl(solution) {
  const daemon = solution.daemons[0];
  const input = solution.queues.find(queue => queue.id === daemon.reads);
  const output = solution.queues.find(queue => queue.id === daemon.emits);
  const database = solution.databases.find(item => item.id === daemon.writes);
  const physicalInput = input?.physical || `${identifier(input?.type || 'message').toLowerCase()}.inbound`;
  const physicalOutput = output?.physical || `${identifier(output?.type || 'message').toLowerCase()}.outbound`;
  return [
    `QUEUE "${input?.id || daemon.reads}" -> "${physicalInput}" MANAGER "${input?.manager || 'qm-default'}" TYPE "${input?.type || 'message'}";`,
    `QUEUE "${output?.id || daemon.emits}" -> "${physicalOutput}" MANAGER "${output?.manager || 'qm-default'}" TYPE "${output?.type || 'message'}";`,
    database ? `DATABASE "${database.id}" -> "${database.physical || database.table}" TYPE "${database.provider}" MANAGER "${database.manager || 'db-default'}";` : '',
    `DEPLOYMENT "${solution.id}" PROJECT "${solution.id}" TARGETS ("js-pmachine") BEGIN`,
    `  DAEMON "${daemon.id}" FILE "programs/${daemon.id}.pas" QUEUE "${input?.id || daemon.reads}" -> "${output?.id || daemon.emits}" TARGETS ("js-pmachine") STARTUP TRUE;`,
    daemon.uses ? `  SERVICE "${daemon.uses}" FILE "services/${daemon.uses}.pas" QUEUE "service.${daemon.uses}.in" -> "service.${daemon.uses}.out" TARGETS ("js-pmachine", "java-node-01", "esp32-edge-pool") STARTUP TRUE PERSISTENT TRUE MIN_INSTANCES 1 MAX_INSTANCES 4 IDLE_TIMEOUT 5 M;` : '',
    'END;'
  ].filter(Boolean).join('\n');
}

export function compileSolutionDsl(sourceText, options = {}) {
  const ir = parseSolutionDsl(sourceText);
  const pascalish = renderPascalish(ir);
  const wfl = renderWfl(ir);
  const pascalishArtifact = compilePascalishProgramWithAntlr(pascalish);
  const manifest = {
    solutionId: ir.id,
    compilerVersion: 'solution-dsl-v1',
    sourceFile: options.fileName || null,
    requiredCapabilities: ['queue.enqueue', 'queue.dequeue', 'daemon.refresh', ...ir.databases.map(item => `database.${item.provider}`), ...ir.conversions.map(item => `conversion.${item.id}`)],
    generatedLanguages: ['pascalish', 'mapl', 'wfl'],
    runtimeUnit: pascalishArtifact.programMap.runtimeUnit
  };
  return { ir, pascalish, wfl, pcodeText: pascalishArtifact.pcodeText, programMap: pascalishArtifact.programMap, manifest };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const sourcePath = process.argv[2];
  if (!sourcePath) throw new Error('Usage: node compile-solution-dsl.mjs <file.solution>');
  const source = await fs.readFile(sourcePath, 'utf8');
  const result = compileSolutionDsl(source, { fileName: sourcePath });
  process.stdout.write(JSON.stringify(result, null, 2));
}