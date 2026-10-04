import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compilePascalishProgramWithAntlr } from '../../scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { compileWorkflowDSLWithAntlr } from '../../scripts/workflow-antlr-compiler.mjs';
import { runPascalOnEsp32, runPcodeOnEsp32 } from '../../scripts/run-pascal-on-esp32-node.mjs';
import { runSingleMessageForEvolution } from '../../../pmachines/javascript/index.mjs';
import {
  createJavaScriptPmachineDebugSession,
  setJavaScriptPmachineDebugBreakpoints,
  setJavaScriptPmachineSourceBreakpoints,
  stepJavaScriptPmachineDebugSession,
  getJavaScriptPmachineDebugState
} from './modules/javascriptPmachineDebugger.mjs';
import {
  startEsp32DebugSession,
  readEsp32DebugSession,
  controlEsp32DebugSession,
  stopEsp32DebugSession
} from './modules/esp32PmachineDebugBridge.mjs';

function resolveQueueOverride(wflText, sourceFileName, deploymentId = '', resourceId = '') {
  if (!String(wflText || '').trim()) return null;
  const compiled = compileWorkflowDSLWithAntlr(String(wflText));
  const deployments = Array.isArray(compiled?.deployments) ? compiled.deployments : [];
  const deployment = deploymentId
    ? deployments.find((item) => String(item?.id || '') === deploymentId)
    : deployments[0];
  if (!deployment) throw new Error(`WFL deployment '${deploymentId || '(first)'}' was not found`);
  const sourceBase = path.basename(String(sourceFileName || ''));
  const resource = (resourceId ? deployment.resources?.find((item) => String(item?.id || '') === resourceId) : null)
    || deployment.resources?.find((item) => path.basename(String(item?.fileName || '')) === sourceBase)
    || deployment.resources?.[0];
  if (!resource) throw new Error(`WFL deployment '${deployment.id}' has no matching resource`);
  return {
    deploymentId: deployment.id,
    resourceId: resource.id,
    inputQueue: resource.inputQueue,
    outputQueue: resource.outputQueue
  };
}

async function runJs(pcodeText, programMap, inputQueue, message) {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-api-deploy-'));
  const pcodePath = path.join(tempDirectory, 'program.pcode');
  const mapPath = path.join(tempDirectory, 'program.map.json');
  try {
    await fs.writeFile(pcodePath, pcodeText, 'utf8');
    await fs.writeFile(mapPath, JSON.stringify(programMap, null, 2), 'utf8');
    return runSingleMessageForEvolution({
      pcode: pcodePath,
      programMap: mapPath,
      inputQueue,
      message,
      messageFile: null,
      serviceId: programMap.serviceId || '',
      organismId: '',
      generation: '0',
      fitnessOut: ''
    });
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true }).catch(() => {});
  }
}

export function registerPmachineDeploymentRoutes(app) {
  app.post('/api/pmachine/deploy-and-run', async (req, res) => {
    let sourcePath = '';
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const source = String(body.source || '');
      const pcodeText = String(body.pcodeText || body.pcode || '');
      const suppliedProgramMap = body.programMap && typeof body.programMap === 'object' && !Array.isArray(body.programMap)
        ? body.programMap
        : null;
      const sourceFileName = String(body.sourceFileName || 'program.program.pas').trim() || 'program.program.pas';
      const runtime = String(body.runtime || 'js').trim().toLowerCase();
      const targetNodeId = String(body.targetNodeId || body.node || '').trim();
      const message = String(body.message ?? '');
      const wflOverride = resolveQueueOverride(body.wflSource, sourceFileName, body.wflDeploymentId, body.wflResourceId);
      const inputQueue = String(wflOverride?.inputQueue || body.inputQueue || 'deploy-api.in').trim();

      if (!source.trim() && !pcodeText.trim()) return res.status(400).json({ error: 'source or pcodeText is required' });
      if (pcodeText.trim() && !suppliedProgramMap) return res.status(400).json({ error: 'programMap is required with pcodeText' });
      if (!['js', 'esp32'].includes(runtime)) return res.status(400).json({ error: 'runtime must be js or esp32' });
      if (runtime === 'esp32' && !targetNodeId) return res.status(400).json({ error: 'targetNodeId is required for ESP32 runs' });

      let compiled;
      if (pcodeText.trim()) {
        compiled = { pcodeText, programMap: suppliedProgramMap };
      } else {
        const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-api-source-'));
        sourcePath = path.join(tempDirectory, path.basename(sourceFileName));
        await fs.writeFile(sourcePath, source, 'utf8');
        compiled = compilePascalishProgramWithAntlr(source, { fileName: sourceFileName });
      }
      const debug = body.debug === true;

      if (runtime === 'esp32') {
        const result = pcodeText.trim()
          ? await runPcodeOnEsp32({
            pcodeText,
            programMap: suppliedProgramMap,
            node: targetNodeId,
            inputQueue,
            message,
            maxSteps: body.maxSteps,
            sourceFileName
          })
          : await runPascalOnEsp32({ source: sourcePath, node: targetNodeId, inputQueue, message });
        return res.json({ status: 'ok', runtime, targetNodeId, inputQueue, wflOverride, debugFallback: debug, result });
      }

      if (debug) {
        const state = createJavaScriptPmachineDebugSession({
          pcodeText: compiled.pcodeText,
          programMap: compiled.programMap,
          sourceMap: compiled.programMap?.sourceMap || {},
          inputQueue,
          sourceMessage: message
        });
        const breakpoints = Array.isArray(body.breakAt) ? body.breakAt.map(Number).filter(Number.isInteger) : [];
        if (breakpoints.length > 0) setJavaScriptPmachineDebugBreakpoints(state.id, breakpoints);
        const sourceBreakpoints = Array.isArray(body.sourceBreakpoints)
          ? body.sourceBreakpoints
          : Number.isInteger(Number(body.breakAtSourceLine))
            ? [{ sourceFile: sourceFileName, sourceLanguage: 'pascalish', sourceLine: Number(body.breakAtSourceLine) }]
            : [];
        if (sourceBreakpoints.length > 0) setJavaScriptPmachineSourceBreakpoints(state.id, sourceBreakpoints);
        const stepCount = Math.max(0, Number.parseInt(body.stepCount, 10) || 0);
        for (let index = 0; index < stepCount; index += 1) {
          const current = getJavaScriptPmachineDebugState(state.id);
          if (!current || current.status === 'completed' || current.status === 'error') break;
          stepJavaScriptPmachineDebugSession(state.id);
        }
        return res.status(201).json({
          status: 'ok', runtime, targetNodeId: targetNodeId || 'local-js-pmachine', inputQueue, wflOverride,
          debug: true, session: getJavaScriptPmachineDebugState(state.id)
        });
      }

      const result = await runJs(compiled.pcodeText, compiled.programMap, inputQueue, message);
      return res.json({ status: 'ok', runtime, targetNodeId: targetNodeId || 'local-js-pmachine', inputQueue, wflOverride, result });
    } catch (error) {
      return res.status(400).json({ error: error?.message || String(error) });
    } finally {
      if (sourcePath) await fs.rm(path.dirname(sourcePath), { recursive: true, force: true }).catch(() => {});
    }
  });

  // Deploy a pcode program to a pmachine at a given address and drive it one
  // statement at a time. Mirrors the on-device /pmachine/debug/session contract
  // so the VS Code debug adapter can talk to the backend instead of the board.
  app.post('/api/pmachine/debug/esp32/session', async (req, res) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const host = String(body.host || body.ip || body.targetHost || '').trim();
      if (!host) return res.status(400).json({ error: 'host is required' });
      const source = String(body.source || '');
      const sourceFileName = String(body.sourceFileName || 'program.pas');
      const compiled = source.trim()
        ? compilePascalishProgramWithAntlr(source, { fileName: sourceFileName })
        : null;
      const pcode = String(body.pcode || compiled?.pcodeText || '');
      const programMap = body.programMap && typeof body.programMap === 'object'
        ? body.programMap
        : compiled?.programMap;
      if (!pcode.trim() && !String(body.pcodeFile || '').trim()) {
        return res.status(400).json({ error: 'source, pcode, or pcodeFile is required' });
      }
      const requestedPcs = Array.isArray(body.breakpoints)
        ? body.breakpoints.map(Number).filter((value) => Number.isInteger(value) && value >= 0)
        : [];
      const sourceLines = Array.isArray(body.sourceBreakpoints)
        ? body.sourceBreakpoints.map(Number).filter((value) => Number.isInteger(value) && value > 0)
        : [];
      const sourceMap = programMap?.sourceMap && typeof programMap.sourceMap === 'object'
        ? programMap.sourceMap
        : {};
      const sourcePcs = Object.entries(sourceMap)
        .filter(([, entry]) => sourceLines.includes(Number(entry?.sourceLine)))
        .map(([pc]) => Number(pc))
        .filter((value) => Number.isInteger(value) && value >= 0);
      const session = await startEsp32DebugSession({
        host,
        pcode,
        pcodeFile: body.pcodeFile,
        programMap,
        startPc: body.startPc,
        breakpoints: [...new Set([...requestedPcs, ...sourcePcs])],
        maxBytes: body.maxBytes
      });
      return res.status(201).json({ status: 'ok', session, sourceMap });
    } catch (error) {
      return res.status(400).json({ error: error?.message || String(error) });
    }
  });

  app.get('/api/pmachine/debug/esp32/session', async (req, res) => {
    try {
      const state = await readEsp32DebugSession({
        host: req.query.host || req.query.ip,
        sessionId: req.query.sessionId || req.query.id
      });
      return res.json({ status: 'ok', state });
    } catch (error) {
      return res.status(400).json({ error: error?.message || String(error) });
    }
  });

  app.post('/api/pmachine/debug/esp32/session/:action', async (req, res) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const state = await controlEsp32DebugSession({
        host: body.host || body.ip || req.query.host,
        sessionId: body.sessionId || body.id || req.query.sessionId,
        action: req.params.action,
        pc: body.pc ?? req.query.pc
      });
      return res.json({ status: 'ok', state });
    } catch (error) {
      return res.status(400).json({ error: error?.message || String(error) });
    }
  });

  app.delete('/api/pmachine/debug/esp32/session', async (req, res) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const result = await stopEsp32DebugSession({
        host: body.host || body.ip || req.query.host,
        sessionId: body.sessionId || body.id || req.query.sessionId
      });
      return res.json({ status: 'ok', ...result });
    } catch (error) {
      return res.status(400).json({ error: error?.message || String(error) });
    }
  });
}
