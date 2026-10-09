import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const AGGREGATOR_CANDIDATES = ['aggregator', path.join('virtualMachines', 'esp32', 'aggregator')];
let pending;
function backendUrl() {
    try {
        return new URL(vscode.workspace.getConfiguration('pulse-pmachine').get('backendUrl', 'http://127.0.0.1:4000'));
    }
    catch {
        return undefined;
    }
}
function companions(backend) {
    return [
        { name: 'Data Librarian', script: 'data-librarian.mjs', url: 'http://127.0.0.1:4300', portEnv: 'LIBRARIAN_PORT' },
        { name: 'Data Mapper', script: 'data-mapper.mjs', url: 'http://127.0.0.1:4200', portEnv: 'MAPPER_PORT' },
        { name: 'Aggregator backend', script: 'backend.mjs', url: backend.origin, portEnv: 'PORT' },
    ];
}
function findAggregator() {
    const configured = vscode.workspace.getConfiguration('pulse-pmachine').get('aggregatorPath', '').trim();
    const roots = configured ? [configured] : (vscode.workspace.workspaceFolders ?? []).flatMap(folder => AGGREGATOR_CANDIDATES.map(candidate => path.join(folder.uri.fsPath, candidate)));
    return roots.find(root => fs.existsSync(path.join(root, 'data-librarian.mjs')));
}
async function healthy(url) {
    try {
        return (await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) })).ok;
    }
    catch {
        return false;
    }
}
async function waitHealthy(url, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await healthy(url))
            return true;
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return false;
}
async function ensure(output, logDir, explicit) {
    const backend = backendUrl();
    if (!backend || !LOOPBACK.has(backend.hostname)) {
        if (explicit)
            void vscode.window.showWarningMessage('Pulse: local services are only started when pulse-pmachine.backendUrl points at this machine.');
        return false;
    }
    const aggregator = findAggregator();
    if (!aggregator) {
        if (explicit)
            void vscode.window.showErrorMessage('Pulse: aggregator folder not found. Set pulse-pmachine.aggregatorPath.');
        return false;
    }
    const missing = [];
    for (const companion of companions(backend)) {
        if (!(await healthy(companion.url)))
            missing.push(companion);
    }
    if (!missing.length) {
        if (explicit)
            void vscode.window.showInformationMessage('Pulse: backend, Data Librarian and Data Mapper are already running.');
        return false;
    }
    const node = vscode.workspace.getConfiguration('pulse-pmachine').get('nodePath', 'node') || 'node';
    fs.mkdirSync(logDir, { recursive: true });
    const started = await Promise.all(missing.map(async (companion) => {
        const log = path.join(logDir, companion.script.replace(/\.mjs$/, '.log'));
        const fd = fs.openSync(log, 'a');
        try {
            // Detached so services survive window reloads; the next activation finds them healthy.
            const child = spawn(node, [companion.script], {
                cwd: aggregator, detached: true, windowsHide: true, stdio: ['ignore', fd, fd],
                env: { ...process.env, [companion.portEnv]: new URL(companion.url).port },
            });
            child.on('error', error => output.appendLine(`Local services: ${companion.name} failed to start: ${error.message}`));
            child.unref();
            output.appendLine(`Local services: starting ${companion.name} (pid ${child.pid}), log ${log}`);
        }
        finally {
            fs.closeSync(fd);
        }
        const ok = await waitHealthy(companion.url, companion.script === 'backend.mjs' ? 90000 : 30000);
        output.appendLine(`Local services: ${companion.name} ${ok ? 'is healthy' : 'did not become healthy; see log'} at ${companion.url}`);
        return { companion, ok };
    }));
    const failed = started.filter(item => !item.ok).map(item => item.companion.name);
    if (failed.length)
        void vscode.window.showWarningMessage(`Pulse: ${failed.join(', ')} did not start.   See the Pulse PMachine output.`);
    return true;
}
export function ensureLocalServices(output, logDir, explicit = false) {
    if (!explicit && !vscode.workspace.getConfiguration('pulse-pmachine').get('autoStartLocalServices', true)) {
        return Promise.resolve(false);
    }
    if (!vscode.workspace.isTrusted)
        return Promise.resolve(false);
    pending ??= ensure(output, logDir, explicit)
        .catch(error => { output.appendLine(`Local services: ${error instanceof Error ? error.message : String(error)}`); return false; })
        .finally(() => { pending = undefined; });
    return pending;
}
//# sourceMappingURL=localServices.js.map