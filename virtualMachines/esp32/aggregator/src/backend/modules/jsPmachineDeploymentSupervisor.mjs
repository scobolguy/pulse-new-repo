import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

function normalizeKind(value) {
  const kind = String(value || 'service').trim().toLowerCase();
  return ['program', 'service', 'daemon'].includes(kind) ? kind : 'service';
}

function deploymentKey(deployment) {
  return String(deployment?.key || deployment?.deploymentId || `${deployment?.serviceName || 'deployment'}:${deployment?.targetNodeId || '*'}`).trim();
}

export function createJsPmachineDeploymentSupervisor({ runnerPath = path.resolve(process.cwd(), 'scripts/run-js-pmachine.mjs') } = {}) {
  const processes = new Map();
  const states = new Map();

  function setState(deployment, patch) {
    const key = deploymentKey(deployment);
    const current = states.get(key) || {};
    const next = { ...current, key, deploymentId: deployment?.deploymentId || null, serviceName: deployment?.serviceName || null, workloadKind: normalizeKind(deployment?.workloadKind), targetNodeId: deployment?.targetNodeId || null, ...patch, updatedAt: new Date().toISOString() };
    states.set(key, next);
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
    const kind = normalizeKind(deployment?.workloadKind);
    const artifacts = await artifactPaths(deployment);
    if (!artifacts.ready) return setState(deployment, { state: 'pending-artifacts', mode: kind === 'program' ? 'one-shot' : 'poll', artifacts });

    const metadata = deployment?.metadata && typeof deployment.metadata === 'object' ? deployment.metadata : {};
    const args = ['--pcode', artifacts.pcodePath, '--program-map', artifacts.programMapPath, '--input-queue', String(metadata.inputQueue || 'default.in'), '--poll', '--poll-interval', String(Number(metadata.pollIntervalMs || 100))];
    const child = spawn(process.execPath, [runnerPath, ...args], { cwd: process.cwd(), windowsHide: true, stdio: 'ignore' });
    processes.set(key, child);
    setState(deployment, { state: 'running', mode: 'poll', pid: child.pid, artifacts });
    child.once('exit', (code, signal) => {
      processes.delete(key);
      setState(deployment, { state: code === 0 ? 'stopped' : 'failed', exitCode: code, signal });
    });
    return states.get(key);
  }

  async function stop(deployment) {
    const key = deploymentKey(deployment);
    const child = processes.get(key);
    if (child && !child.killed) child.kill();
    processes.delete(key);
    return setState(deployment, { state: 'stopped' });
  }

  async function restore(deployments = []) {
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
  }

  return { start, stop, restore, list, shutdown };
}
