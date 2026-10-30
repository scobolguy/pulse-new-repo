import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileWorkflowDSL } from '../../../../languages/wfl/src/compile-workflow-dsl.mjs';
import { compileWorkflowToPcode } from '../../../../languages/wfl/src/compile-workflow-to-pcode.mjs';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { compileMaplWithAntlr } from '../../../../languages/mapl/src/compile-mapl-antlr-to-pcode.mjs';

function required(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
  return value;
}

function fileToken(value) {
  return Buffer.from(required(value, 'Artifact id')).toString('hex');
}

function interpolate(value, compiled) {
  const variables = { ...compiled.configuration?.variables, ENVIRONMENT: compiled.configuration?.environment || 'default' };
  return String(value).replace(/\$\{([^}]+)\}/g, (_, key) => {
    if (!Object.hasOwn(variables, key)) throw new Error(`VFL references unknown WFL variable '${key}'`);
    return variables[key];
  });
}

function queueName(symbol, compiled) {
  const name = interpolate(required(symbol, 'Queue name or symbol'), compiled);
  return compiled.symbols?.queues?.find(queue => queue.symbol === name)?.queueName || name;
}

export function planVflGraph(flow, resource, compiled, deploymentId) {
  if (flow?.kind !== 'visual-flow-language' || !Array.isArray(flow.nodes) || !Array.isArray(flow.edges)) {
    throw new Error('VFL requires kind "visual-flow-language", nodes and edges arrays');
  }
  if (!flow.nodes.length) throw new Error(`VFL '${resource.id}' has no nodes`);
  const nodes = new Map();
  for (const node of flow.nodes) {
    required(node.id, 'VFL node id');
    if (nodes.has(node.id)) throw new Error(`Duplicate VFL node '${node.id}'`);
    if (!['queue', 'service', 'program', 'daemon', 'map'].includes(node.kind)) {
      throw new Error(`VFL node '${node.id}': kind '${node.kind}' is not executable`);
    }
    if (node.kind !== 'queue') required(node.execution?.sourceFile, `NODE '${node.id}' execution.sourceFile`);
    nodes.set(node.id, node);
  }
  const environment = compiled.configuration?.environment || 'default';
  const prefix = `${environment}.${deploymentId}.${resource.id}`;
  const incoming = new Map(flow.nodes.map(node => [node.id, []]));
  const outgoing = new Map(flow.nodes.map(node => [node.id, []]));
  const links = new Set();
  for (const edge of flow.edges) {
    if (edge.type !== 'message-broker-call') {
      throw new Error(`VFL LINK '${edge.from}' -> '${edge.to}': '${edge.type}' is not implemented for deployment; use message-broker-call`);
    }
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) throw new Error(`VFL LINK '${edge.from}' -> '${edge.to}' has an unknown endpoint`);
    const key = `${JSON.stringify(edge.from)}:${JSON.stringify(edge.to)}`;
    if (links.has(key)) throw new Error(`Duplicate VFL LINK '${edge.from}' -> '${edge.to}'`);
    links.add(key);
    if (from.kind === 'queue' && to.kind === 'queue') throw new Error('A queue-to-queue link requires an executable forwarding node');
    const queue = edge.queue
      ? queueName(edge.queue, compiled)
      : from.kind === 'queue'
        ? queueName(from.queue || from.label || from.id, compiled)
        : to.kind === 'queue'
          ? queueName(to.queue || to.label || to.id, compiled)
          : `${prefix}.${to.id}.in`;
    for (const endpoint of [from, to].filter(node => node.kind === 'queue')) {
      const declared = queueName(endpoint.queue || endpoint.label || endpoint.id, compiled);
      if (queue !== declared) throw new Error(`LINK '${edge.from}' -> '${edge.to}' queue '${queue}' conflicts with queue NODE '${endpoint.id}' (${declared})`);
    }
    incoming.get(to.id).push(queue);
    outgoing.get(from.id).push(queue);
  }
  return flow.nodes.filter(node => node.kind !== 'queue').map(node => {
    const inputs = [...new Set(incoming.get(node.id))];
    if (inputs.length > 1) throw new Error(`NODE '${node.id}' has multiple input queues; use one shared queue or an explicit merge node`);
    const inputQueue = inputs[0] || queueName(node.execution.inputQueue || `${prefix}.${node.id}.in`, compiled);
    const outputQueues = [...new Set(outgoing.get(node.id))];
    const targets = node.target?.nodeId ? [interpolate(node.target.nodeId, compiled)] : resource.targets;
    if (!Array.isArray(targets) || !targets.length || targets.some(target => typeof target !== 'string' || !target.trim())) {
      throw new Error(`NODE '${node.id}' requires deployment targets`);
    }
    return { node, inputQueue, outputQueues, targets };
  });
}

function bindPcode(artifact, item) {
  const inputSymbol = item.node.execution.inputSymbol || 'flow.input';
  const outputSymbol = item.node.execution.outputSymbol || 'flow.output';
  const sourceMap = {};
  let address = 0;
  let sourceAddress = 0;
  let boundOutputs = 0;
  const lines = artifact.pcodeText.split(/\r?\n/).flatMap(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.endsWith(':')) return [line];
    const location = artifact.programMap.sourceMap?.[String(sourceAddress++)];
    const match = trimmed.match(/^(ROUTE_MATCH_QUEUE|ROUTE_EMIT)\s+("(?:\\.|[^"\\])*")$/);
    let replacement = [line];
    if (match) {
      const queue = JSON.parse(match[2]);
      if (match[1] === 'ROUTE_MATCH_QUEUE' && queue === inputSymbol) {
        replacement = [`ROUTE_MATCH_QUEUE ${JSON.stringify(item.inputQueue)}`];
      } else if (match[1] === 'ROUTE_EMIT' && queue === outputSymbol) {
        if (!item.outputQueues.length) throw new Error(`NODE '${item.node.id}' emits '${outputSymbol}' but has no output links`);
        replacement = item.outputQueues.map(output => `ROUTE_EMIT ${JSON.stringify(output)}`);
        boundOutputs += 1;
      } else if (match[1] === 'ROUTE_EMIT' && !item.outputQueues.includes(queue)) {
        throw new Error(`NODE '${item.node.id}' emits queue '${queue}' which is not connected in the VFL graph`);
      }
    }
    for (const instruction of replacement) {
      if (location) sourceMap[String(address)] = { ...location, instruction };
      address += 1;
    }
    return replacement;
  });
  if (item.outputQueues.length && !boundOutputs) {
    throw new Error(`NODE '${item.node.id}' has output links but its code does not emit queue '${outputSymbol}'`);
  }
  return { pcodeText: lines.join('\n'), programMap: { ...artifact.programMap, sourceMap } };
}

async function compileNode(item, flowDirectory, compiled) {
  const sourceFile = path.resolve(flowDirectory, interpolate(item.node.execution.sourceFile, compiled));
  const source = await fs.readFile(sourceFile, 'utf8');
  const extension = path.extname(sourceFile).toLowerCase();
  let artifact;
  if (extension === '.wfl') {
    const workflows = compileWorkflowDSL(source, {
      environment: compiled.configuration?.environment,
      variables: {
        ...compiled.configuration?.variables,
        FLOW_INPUT: 'flow.input',
        FLOW_OUTPUT: 'flow.output'
      }
    });
    const workflowId = item.node.execution.workflowId || (workflows.workflows.length === 1 ? workflows.workflows[0].id : null);
    if (!workflowId) throw new Error(`NODE '${item.node.id}' must specify execution.workflowId`);
    const result = compileWorkflowToPcode(workflows, workflowId, { sourceText: source, fileName: sourceFile });
    if (result.notes.some(note => /ignored$/.test(note.type) || ['try_block', 'cobegin'].includes(note.type))) {
      throw new Error(`NODE '${item.node.id}' contains WFL steps that the pcode compiler cannot execute`);
    }
    artifact = { pcodeText: result.pcodeText, programMap: { version: 1, entries: [], sourceMap: result.sourceMap, sourceLanguage: 'wfl' } };
  } else if (extension === '.mapl') {
    const result = compileMaplWithAntlr(source);
    if (result.programMap.compatibility.some(map => map.irOnly.length)) throw new Error(`NODE '${item.node.id}' contains non-executable MAPL constructs`);
    if (item.node.kind === 'daemon' && item.node.execution.hostedUdpMapper === true) {
      const refreshMs = Number(item.node.execution.refreshMs ?? 60000);
      if (!Number.isSafeInteger(refreshMs) || refreshMs < 10 || refreshMs > 180000) {
        throw new Error(`NODE '${item.node.id}' requires refreshMs between 10 and 180000`);
      }
      if (!result.ast.maps.length) throw new Error(`NODE '${item.node.id}' requires at least one MAPL map`);
      const entries = result.programMap.entries.map(({ maplIr, ...entry }) => entry);
      artifact = {
        pcodeText: [
          '# UDP request: {"mapId":"MapName","source":{...}}',
          'CALL_EXT host.event_method 0',
          'PUSH_STR "UDP"',
          'STREQ',
          'JZ TIMER_TURN',
          'CALL_EXT host.event_body 0',
          'PUSH_STR "mapId"',
          'CALL_EXT host.json_path_text 2',
          'CALL_EXT host.event_body 0',
          'PUSH_STR "source"',
          'CALL_EXT host.json_value 2',
          'CALL_EXT host.map_apply 2',
          'CALL_EXT host.udp_reply 1',
          'TIMER_TURN:',
          'HALT',
          ''
        ].join('\n'),
        programMap: {
          ...result.programMap,
          hostBindingsVersion: 1,
          targets: ['esp32'],
          runtimeUnit: { kind: 'daemon', id: item.node.id, refreshMs },
          entries
        }
      };
    } else {
      if (result.ast.maps.length !== 1) throw new Error(`NODE '${item.node.id}' requires a MAPL source with exactly one map`);
      const mapId = result.programMap.entryMapId;
      artifact = {
        pcodeText: `ROUTE_TRANSFORM ${JSON.stringify(`output := map(${JSON.stringify(mapId)}, src);`)}\nROUTE_EMIT "flow.output"\nHALT\n`,
        programMap: result.programMap
      };
    }
  } else if (['.pas', '.pash'].includes(extension)) {
    artifact = compilePascalishProgramWithAntlr(source, {
      fileName: sourceFile,
      hostServices: item.node.execution.hosted === true
    });
    if (artifact.programMap.hostBindingsVersion && item.node.execution.hosted !== true) {
      throw new Error(`NODE '${item.node.id}' uses hosted bindings; set execution.hosted for hosted service deployment`);
    }
    if (artifact.programMap.runtimeUnit?.kind === 'service'
      && !(item.node.kind === 'service' && item.node.execution.hosted === true)) {
      throw new Error(`NODE '${item.node.id}' uses a native Pascalish SERVICE ABI. Use a PROGRAM with ROUTER input/output for queue-based workers; hosted service invocation is not implemented by this builder.`);
    }
  } else {
    throw new Error(`NODE '${item.node.id}': unsupported source file '${sourceFile}' (use Pascalish, MAPL or WFL)`);
  }
  const bound = bindPcode(artifact, item);
  const kind = item.node.kind === 'map' ? 'service' : item.node.kind;
  bound.programMap = {
    ...bound.programMap,
    runtimeUnit: { kind, id: item.node.id, refreshMs: artifact.programMap.runtimeUnit?.refreshMs ?? null },
    flow: { sourceFile, nodeId: item.node.id, inputQueue: item.inputQueue, outputQueues: item.outputQueues }
  };
  return bound;
}

export async function buildVflDeployments(compiled, { artifactRoot = process.cwd(), write = false } = {}) {
  const root = path.resolve(artifactRoot);
  const deployments = [];
  const artifacts = [];
  const artifactNames = new Set();
  for (const deployment of compiled.deployments || []) {
    const resources = [];
    for (const resource of deployment.resources || []) {
      if (resource.kind !== 'flow') {
        resources.push(resource);
        continue;
      }
      const sourceFile = path.resolve(root, resource.fileName);
      if (path.extname(sourceFile).toLowerCase() !== '.vfl') throw new Error(`FLOW '${resource.id}' must reference a .vfl file`);
      const flow = JSON.parse(await fs.readFile(sourceFile, 'utf8'));
      const items = planVflGraph(flow, resource, compiled, deployment.id);
      if (!items.length) throw new Error(`FLOW '${resource.id}' has no executable nodes`);
      for (const item of items) {
        const artifact = await compileNode(item, path.dirname(sourceFile), compiled);
        artifact.programMap.serviceId = `${deployment.id}.${resource.id}.${item.node.id}`;
        const stem = path.join('.pulse-build', fileToken(compiled.configuration?.environment || 'default'), fileToken(deployment.id), fileToken(resource.id), fileToken(item.node.id));
        const fileName = `${stem}.pcode`;
        if (artifactNames.has(fileName)) throw new Error(`Duplicate executable deployment identity '${deployment.id}.${resource.id}.${item.node.id}'`);
        artifactNames.add(fileName);
        const programMapFile = `${stem}.program.json`;
        artifacts.push({ ...artifact, fileName, programMapFile });
        resources.push({
          kind: item.node.kind === 'map' ? 'service' : item.node.kind,
          id: `${deployment.id}.${resource.id}.${item.node.id}`,
          fileName,
          programMapFile,
          inputQueue: item.inputQueue,
          outputQueue: item.outputQueues.join(','),
          targets: item.targets,
          startup: resource.startup,
          flowId: resource.id,
          nodeId: item.node.id
        });
      }
    }
    deployments.push({ ...deployment, resources });
  }
  if (write) await writeVflArtifacts(artifacts, root);
  return { compiled: { ...compiled, deployments }, artifacts };
}

export async function writeVflArtifacts(artifacts, artifactRoot) {
  for (const artifact of artifacts) {
    await fs.mkdir(path.dirname(path.join(artifactRoot, artifact.fileName)), { recursive: true });
    await fs.writeFile(path.join(artifactRoot, artifact.fileName), artifact.pcodeText, 'utf8');
    await fs.writeFile(path.join(artifactRoot, artifact.programMapFile), `${JSON.stringify(artifact.programMap, null, 2)}\n`, 'utf8');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    let input;
    let environment;
    let write = false;
    const variables = {};
    for (let index = 0; index < args.length; index += 1) {
      const flag = args[index];
      if (flag === '--write') { write = true; continue; }
      if (!['--in', '--environment', '--define'].includes(flag)) throw new Error(`Unknown option '${flag}'`);
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
      if (flag === '--in') input = value;
      else if (flag === '--environment') environment = value;
      else {
        const equals = value.indexOf('=');
        if (equals < 1) throw new Error('--define requires name=value');
        variables[value.slice(0, equals)] = value.slice(equals + 1);
      }
    }
    if (!input) throw new Error('Usage: --in deployment.wfl [--environment test] [--define name=value] [--write]');
    const sourceFile = path.resolve(input);
    const compiled = compileWorkflowDSL(await fs.readFile(sourceFile, 'utf8'), { environment, variables });
    const result = await buildVflDeployments(compiled, { artifactRoot: path.dirname(sourceFile), write });
    console.log(JSON.stringify({ deployments: result.compiled.deployments, artifacts: result.artifacts.map(({ fileName, programMapFile }) => ({ fileName, programMapFile })) }, null, 2));
  } catch (error) {
    console.error(`[VFL-BUILD] ${error.message}`);
    process.exitCode = 1;
  }
}
