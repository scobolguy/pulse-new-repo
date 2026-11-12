import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createPmachineProcessSlots } from './pmachineProcessSlots.mjs';
import { resolveFixedBootProgram } from './pmachineBoot.mjs';

function normalizeKind(value) {
  const kind = String(value || 'service').trim().toLowerCase();
  return ['program', 'service', 'daemon'].includes(kind) ? kind : 'service';
}

function deploymentKey(deployment) {
  return String(deployment?.key || deployment?.deploymentId || `${deployment?.serviceName || 'deployment'}:${deployment?.targetNodeId || '*'}`).trim();
}

export function createJsPmachineDeploymentSupervisor({
  runnerPath = path.resolve(process.cwd(), '..', 'pmachines', 'javascript', 'run.mjs'),
  statePath = null,
  bootDirectory = null
} = {}) {
  const processes = new Map();
  const states = new Map();
  const slots = createPmachineProcessSlots();
  let persisted = { version: 1, states: [] };

  async function saveState() {
    if (!statePath) return;
    const temporary = `${statePath}.pending-${process.pid}`;
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await fs.writeFile(temporary, JSON.stringify(persisted, null, 2) + '\n', 'utf8');
    await fs.rename(temporary, statePath);
  }

  async function loadState() {
    if (!statePath) return;
    try {
      const parsed = JSON.parse(await fs.readFile(statePath, 'utf8'));
      if (parsed?.version !== 1 || !Array.isArray(parsed.states)) throw new Error('Invalid pmachine state version');
      persisted = parsed;
      for (const state of parsed.states) {
        if (state?.key) states.set(state.key, { ...state, state: 'recovering', pid: undefined });
      }
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw new Error(`Unable to load pmachine state: ${error.message}`);
    }
  }

  function setState(deployment, patch) {
    const key = deploymentKey(deployment);
    const current = states.get(key) || {};
    const next = { ...current, key, deploymentId: deployment?.deploymentId || null, serviceName: deployment?.serviceName || null, workloadKind: normalizeKind(deployment?.workloadKind), targetNodeId: deployment?.targetNodeId || null, ...patch, updatedAt: new Date().toISOString() };
    states.set(key, next);
    persisted.states = Array.from(states.values()).map(({ pid, ...state }) => state);
    void saveState().catch(error => {
      states.set(key, { ...next, persistenceError: error.message });
    });
    return next;
  }

  async function artifactPaths(deployment) {
    const metadata = deployment?.metadata && typeof deployment.metadata === 'object' ? deployment.metadata : {};
    const pcodePath = String(metadata.pcodePath || metadata.pcode || '').trim();
    const programMapPath = String(metadata.programMapPath || metadata.programMap || '').trim();
    if (!pcodePath || !programMapPath) return { pcodePath, programMapPath, ready: false };
    try {
      await fs.access(pcodePath);
      await fs.access(programMapPath);
      return { pcodePath, programMapPath, ready: true };
    } catch {
      return { pcodePath, programMapPath, ready: false };
    }
  }

  async function start(deployment) {
    const key = deploymentKey(deployment);
    if (processes.has(key)) return setState(deployment, { state: 'running', mode: 'poll', reused: true });
    const requestedState = deployment?.runtimeState
      || (deployment?.metadata?.startup === false ? 'stopped' : 'running');
    if (requestedState !== 'running') {
      return setState(deployment, { state: requestedState, mode: 'not-started' });
    }
    const kind = normalizeKind(deployment?.workloadKind);
    const artifacts = await artifactPaths(deployment);
    if (!artifacts.ready) return setState(deployment, { state: 'pending-artifacts', mode: kind === 'program' ? 'one-shot' : 'poll', artifacts });

    const metadata = deployment?.metadata && typeof deployment.metadata === 'object' ? deployment.metadata : {};
    const args = ['--pcode', artifacts.pcodePath, '--program-map', artifacts.programMapPath, '--input-queue', String(metadata.inputQueue || 'default.in'), '--poll', '--poll-interval', String(Number(metadata.pollIntervalMs || 100))];
    let assignment;
    try {
      assignment = slots.claim(deployment);
    } catch (error) {
      return setState(deployment, { state: 'capacity-error', mode: 'rejected', error: error.message, artifacts });
    }
    const child = spawn(process.execPath, [runnerPath, ...args], { cwd: process.cwd(), windowsHide: true, stdio: 'ignore' });
    processes.set(key, child);
    setState(deployment, { state: 'running', mode: 'poll', pid: child.pid, artifacts, ...assignment });
    child.once('exit', (code, signal) => {
      processes.delete(key);
      slots.release(key);
      setState(deployment, { state: code === 0 ? 'stopped' : 'failed', exitCode: code, signal, slot: undefined, kind: undefined });
    });
    return states.get(key);
  }

  async function stop(deployment) {
    const key = deploymentKey(deployment);
    const child = processes.get(key);
    if (child && !child.killed) child.kill();
    processes.delete(key);
    slots.release(key);
    return setState(deployment, { state: 'stopped' });
  }

  async function restore(deployments = []) {
    await loadState();
    if (bootDirectory) {
      const boot = await resolveFixedBootProgram(bootDirectory);
      if (boot.state !== 'ready') {
        return [setState({ key: 'boot', deploymentId: null, serviceName: 'pmachine-boot' }, {
          state: 'recovery',
          mode: 'boot-recovery',
          error: boot.reason,
          bootFile: boot.file
        })];
      }
    }
    const results = [];
    for (const deployment of Array.isArray(deployments) ? deployments : []) {
      if (deployment?.runtimeState !== 'running' || deployment?.metadata?.startup === false) {
        results.push(setState(deployment, { state: deployment?.runtimeState || 'stopped', mode: 'not-started' }));
        continue;
      }
      results.push(await start(deployment));
    }
    return results;
  }

  function list() {
    return Array.from(states.values());
  }

  function shutdown() {
    for (const child of processes.values()) {
      if (!child.killed) child.kill();
    }
    processes.clear();
    for (const assignment of slots.list()) slots.release(assignment.key);
  }

  return { start, stop, restore, list, shutdown, slots: slots.list };
}
