import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as vscode from 'vscode';
function languageForFile(filePath) {
    switch (path.extname(filePath).toLowerCase()) {
        case '.cob':
        case '.cobol':
            return 'cobolish';
        case '.bas':
        case '.vb':
        case '.vbs':
            return 'vbish';
        default:
            return 'pascalish';
    }
}
function findProgramEntryLine(source) {
    const lines = source.split(/\r?\n/);
    const blockStarts = [];
    for (let index = 0; index < lines.length; index += 1) {
        const withoutStrings = lines[index].replace(/'(?:''|[^'])*'/g, "''");
        const withoutComments = withoutStrings.replace(/\/\/.*$/, '').replace(/\{.*?\}/g, '');
        const tokens = /\b(begin|end)\b/gi;
        let match;
        while ((match = tokens.exec(withoutComments)) !== null) {
            if (match[1].toLowerCase() === 'begin') {
                blockStarts.push(index + 1);
            }
            else if (blockStarts.length > 0) {
                const startLine = blockStarts.pop();
                if (/\bend\s*\.\s*$/i.test(withoutComments) && blockStarts.length === 0) {
                    return startLine;
                }
            }
        }
    }
    return blockStarts[0] || 1;
}
function pcodeLabelAddress(pcodeText, label) {
    let address = 0;
    for (const rawLine of pcodeText.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#'))
            continue;
        if (line.endsWith(':')) {
            if (line.slice(0, -1) === label)
                return address;
            continue;
        }
        address += 1;
    }
    return 0;
}
class PulsePmachineAdapter {
    configuration;
    messages = new vscode.EventEmitter();
    onDidSendMessage = this.messages.event;
    breakpoints = [];
    runtime;
    debug;
    sessionId = '';
    state = null;
    threadId = 1;
    root;
    emittedOutputCount = 0;
    animate = false;
    animationDelayMs = 500;
    remoteEsp32 = false;
    remoteBaseUrl = '';
    remoteSessionId = '';
    debugApiUrl = '';
    debugApiHost = '';
    remoteSourceMap = {};
    entryLine = 0;
    reachedEntry = false;
    terminated = false;
    constructor(configuration) {
        this.configuration = configuration;
        this.root = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(configuration.program || ''))?.uri.fsPath
            || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
            || process.cwd();
    }
    dispose() {
        if (this.remoteSessionId) {
            void this.remoteRequest(`/pmachine/debug/session?id=${encodeURIComponent(this.remoteSessionId)}`, { method: 'DELETE' }).catch(() => undefined);
        }
        else if (this.sessionId && this.debug) {
            this.debug.stopJavaScriptPmachineDebugSession(this.sessionId);
        }
        this.messages.dispose();
    }
    handleMessage(message) {
        if (message.type !== 'request')
            return;
        void this.handleRequest(message).catch((error) => {
            this.respond(message, false, undefined, error?.message || String(error));
        });
    }
    send(message) {
        this.messages.fire(message);
    }
    respond(request, success = true, body = {}, message) {
        this.send({
            type: 'response',
            seq: 0,
            request_seq: request.seq,
            command: request.command,
            success,
            body,
            message,
        });
    }
    event(event, body = {}) {
        if (event === 'terminated')
            this.terminated = true;
        this.send({ type: 'event', seq: 0, event, body });
    }
    async handleRequest(request) {
        switch (request.command) {
            case 'initialize':
                this.respond(request, true, {
                    supportsConfigurationDoneRequest: true,
                    supportsStepOver: true,
                    supportsTerminateRequest: true,
                    supportsEvaluateForHovers: true,
                    supportsDelayedStackTraceLoading: false,
                });
                this.event('initialized');
                return;
            case 'launch':
                await this.launch(request.arguments || {});
                this.respond(request);
                return;
            case 'setBreakpoints':
                await this.setBreakpoints(request, request.arguments || {});
                return;
            case 'configurationDone':
                this.respond(request);
                if (this.remoteEsp32 && this.configuration.debugSession !== true) {
                    await this.runEsp32Source();
                    return;
                }
                await this.stopAtProgramEntry();
                if (this.animate)
                    void this.animateSource();
                return;
            case 'threads':
                this.respond(request, true, { threads: [{ id: this.threadId, name: this.remoteEsp32 ? 'ESP32 PMachine' : 'JS PMachine' }] });
                return;
            case 'stackTrace':
                this.respond(request, true, { stackFrames: [this.stackFrame()] });
                return;
            case 'scopes':
                this.respond(request, true, { scopes: [
                        { name: 'Globals', variablesReference: 1, expensive: false },
                        { name: 'Locals', variablesReference: 2, expensive: false },
                    ] });
                return;
            case 'variables':
                this.respond(request, true, { variables: this.variables(request.arguments?.variablesReference) });
                return;
            case 'evaluate':
                this.evaluate(request);
                return;
            case 'continue':
                this.respond(request);
                if (this.remoteEsp32)
                    await this.continueEsp32();
                else
                    await this.resumeUntilPause('continue');
                return;
            case 'next':
                this.respond(request);
                if (this.remoteEsp32)
                    await this.stepEsp32('step-over');
                else
                    await this.stepToNextSource('step-over');
                return;
            case 'stepIn':
                this.respond(request);
                if (this.remoteEsp32)
                    await this.stepEsp32('step-in');
                else
                    await this.stepToNextSource('step-in');
                return;
            case 'stepOut':
                this.respond(request);
                if (this.remoteEsp32)
                    await this.stepEsp32('step-out');
                else {
                    this.state = this.debug.stepOutJavaScriptPmachineDebugSession(this.sessionId);
                    this.event('stopped', { reason: 'step', threadId: this.threadId });
                }
                return;
            case 'pause':
                this.respond(request);
                if (this.remoteEsp32) {
                    await this.remoteRequest(`/pmachine/debug/session/pause?id=${encodeURIComponent(this.remoteSessionId)}`, { method: 'POST' });
                    await this.waitForEsp32Stop('pause');
                }
                else {
                    this.state = this.debug.pauseJavaScriptPmachineDebugSession(this.sessionId);
                    this.event('stopped', { reason: 'pause', threadId: this.threadId });
                }
                return;
            case 'disconnect':
            case 'terminate':
                if (this.remoteSessionId) {
                    await this.remoteRequest(`/pmachine/debug/session?id=${encodeURIComponent(this.remoteSessionId)}`, { method: 'DELETE' });
                    this.remoteSessionId = '';
                }
                else if (this.sessionId && this.debug) {
                    this.debug.stopJavaScriptPmachineDebugSession(this.sessionId);
                }
                this.respond(request);
                this.event('terminated');
                return;
            default:
                this.respond(request, false, undefined, `Unsupported request: ${request.command}`);
        }
    }
    async launch(configuration) {
        const program = path.resolve(this.root, String(configuration.program || 'artifactPrograms/towers-of-hanoi-program.pas'));
        let source = await (await import('node:fs/promises')).readFile(program, 'utf8');
        if (Number.isInteger(Number(configuration.esp32DiskCount))) {
            source = source.replace(/diskCount\s*:=\s*\d+/i, `diskCount := ${Number(configuration.esp32DiskCount)}`);
        }
        const language = languageForFile(program);
        const compilerPath = pathToFileURL(path.join(this.root, 'aggregator', 'scripts', language === 'pascalish'
            ? 'compile-pascalish-program-antlr-to-pcode.mjs'
            : 'compile-interoperable-language.mjs')).href;
        const debuggerPath = pathToFileURL(path.join(this.root, 'aggregator', 'src', 'backend', 'modules', 'javascriptPmachineDebugger.mjs')).href;
        const compiler = await import(compilerPath);
        this.debug = await import(debuggerPath);
        const compile = language === 'pascalish'
            ? compiler.compilePascalishProgramWithAntlr
            : language === 'cobolish' ? compiler.compileCobolishToPmachine : compiler.compileVbishToPmachine;
        const artifact = compile(source, { fileName: path.basename(program) });
        this.runtime = { program, language, artifact };
        this.animate = configuration.animate === true;
        this.animationDelayMs = Math.max(50, Number(configuration.animationDelayMs) || 1000);
        this.remoteEsp32 = configuration.runtime === 'esp32';
        this.entryLine = Number(configuration.breakpointLine) || findProgramEntryLine(source);
        this.event('output', { category: 'console', output: `Program entry at source line ${this.entryLine}.\n` });
        if (this.remoteEsp32) {
            this.remoteSourceMap = artifact.programMap?.sourceMap || {};
            this.event('process', { name: 'ESP32 PMachine', systemProcessId: process.pid, isLocalProcess: false, startMethod: 'launch' });
            return;
        }
        this.state = this.debug.createJavaScriptPmachineDebugSession({
            pcodeText: artifact.pcodeText,
            programMap: artifact.programMap,
            sourceMap: artifact.programMap?.sourceMap || {},
        });
        this.sessionId = this.state.id;
        await this.applyBreakpoints();
        this.event('process', { name: 'Pulse JS PMachine', systemProcessId: process.pid, isLocalProcess: true, startMethod: 'launch' });
    }
    async startEsp32DebugSession() {
        const configuration = this.configuration;
        const targetHost = String(configuration.targetHost || '192.168.2.155');
        const fileserverUrl = String(configuration.fileserverUrl || 'http://192.168.2.11:4015').replace(/\/$/, '');
        const tag = `vscode-${Date.now().toString(36)}`;
        const pcodePath = `/vscode-${tag}.pcode`;
        this.debugApiUrl = String(configuration.debugApiUrl || '').replace(/\/$/, '');
        this.debugApiHost = targetHost;
        if (this.debugApiUrl) {
            await this.startEsp32DebugSessionViaApi(targetHost, pcodePath);
            return;
        }
        try {
            const pcode = this.runtime.artifact.pcodeText;
            this.remoteBaseUrl = /^https?:\/\//i.test(targetHost) ? targetHost.replace(/\/$/, '') : `http://${targetHost}`;
            const uploadMode = String(configuration.uploadMode || 'direct').toLowerCase();
            const publish = uploadMode === 'shared'
                ? await fetch(`${fileserverUrl}/ffs/put`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ path: pcodePath, data: pcode }),
                })
                : await fetch(`${this.remoteBaseUrl}/ffs/upload`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ file: pcodePath, body: pcode }),
                });
            if (!publish.ok)
                throw new Error(`${uploadMode} FFS upload failed (${publish.status}): ${await publish.text()}`);
            if (uploadMode === 'shared') {
                const peer = new URL(fileserverUrl);
                const mount = await fetch(`${this.remoteBaseUrl}/ffs/mount`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        mount: '/', target: '/',
                        peer: `${peer.host}${peer.pathname.replace(/\/$/, '')}`,
                        type: 'peer', readOnly: '1', persist: '0',
                    }),
                });
                if (!mount.ok)
                    throw new Error(`ESP32 FFS mount failed (${mount.status}): ${await mount.text()}`);
            }
            const startPc = pcodeLabelAddress(pcode, String(this.runtime.artifact.programMap?.entryLabel || 'MAIN'));
            const breakpointPcs = this.remoteBreakpointAddresses();
            const params = new URLSearchParams({
                file: pcodePath,
                max: String(Math.max(32768, pcode.length * 2)),
                startPc: String(startPc),
                breakpoints: breakpointPcs.join(','),
            });
            const response = await fetch(`${this.remoteBaseUrl}/pmachine/debug/session?${params}`, {
                method: 'POST',
            });
            if (!response.ok)
                throw new Error(`ESP32 debug session failed (${response.status}): ${await response.text()}`);
            const session = await response.json();
            this.remoteSessionId = session.sessionId;
            this.sessionId = session.sessionId;
            this.state = await this.readEsp32State();
            await this.waitForEsp32Stop('entry');
        }
        catch (error) {
            const details = error instanceof Error ? error.message : String(error);
            this.event('output', { category: 'stderr', output: `${details}\n` });
            this.event('output', { category: 'console', output: `ESP32 PMachine failed on ${targetHost}: ${details}\n` });
            this.event('terminated');
        }
    }
    async runEsp32Source() {
        const configuration = this.configuration;
        const targetHost = String(configuration.targetHost || '192.168.2.155');
        const fileserverUrl = String(configuration.fileserverUrl || 'http://192.168.2.11:4015').replace(/\/$/, '');
        const tag = `vscode-${Date.now().toString(36)}`;
        const pcodePath = `/vscode-${tag}.pcode`;
        const mapPath = `/vscode-${tag}.map.json`;
        try {
            const { attachPcodeSignature } = await import(pathToFileURL(path.join(this.root, 'aggregator', 'scripts', 'pcode-signing.mjs')).href);
            const pcode = this.runtime.artifact.pcodeText;
            const remoteProgramMap = { ...this.runtime.artifact.programMap };
            delete remoteProgramMap.sourceMap;
            const programMap = `${JSON.stringify(attachPcodeSignature(remoteProgramMap, pcode), null, 2)}\n`;
            this.remoteBaseUrl = /^https?:\/\//i.test(targetHost) ? targetHost.replace(/\/$/, '') : `http://${targetHost}`;
            const uploadMode = String(configuration.uploadMode || 'direct').toLowerCase();
            for (const [remotePath, data] of [[pcodePath, pcode], [mapPath, programMap]]) {
                const publish = uploadMode === 'shared'
                    ? await fetch(`${fileserverUrl}/ffs/put`, {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ path: remotePath, data }),
                    })
                    : await fetch(`${this.remoteBaseUrl}/ffs/upload`, {
                        method: 'POST',
                        headers: { 'content-type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({ file: remotePath, body: data }),
                    });
                if (!publish.ok)
                    throw new Error(`${uploadMode} FFS upload failed (${publish.status}): ${await publish.text()}`);
            }
            if (uploadMode === 'shared') {
                const peer = new URL(fileserverUrl);
                const mount = await fetch(`${this.remoteBaseUrl}/ffs/mount`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        mount: '/', target: '/',
                        peer: `${peer.host}${peer.pathname.replace(/\/$/, '')}`,
                        type: 'peer', readOnly: '1', persist: '0',
                    }),
                });
                if (!mount.ok)
                    throw new Error(`ESP32 FFS mount failed (${mount.status}): ${await mount.text()}`);
            }
            const execute = await fetch(`${this.remoteBaseUrl}/pmachine/execute_file`, {
                method: 'POST',
                headers: { 'content-type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    file: pcodePath,
                    programMap: mapPath,
                    inputQueue: String(configuration.inputQueue || 'vscode.esp32'),
                    message: String(configuration.message || ''),
                    max: String(Number(configuration.maxSteps) || 65536),
                }),
            });
            const resultText = await execute.text();
            if (!execute.ok)
                throw new Error(`ESP32 PMachine failed (${execute.status}): ${resultText}`);
            const result = JSON.parse(resultText);
            this.event('output', { category: 'console', output: `${JSON.stringify({ targetHost, result }, null, 2)}\n` });
            const output = Array.isArray(result.stdout) ? result.stdout : [];
            for (const line of output) {
                this.emitProgramOutput(line);
                if (this.animate)
                    await new Promise(resolve => setTimeout(resolve, this.animationDelayMs));
            }
            this.event('output', { category: 'console', output: `ESP32 PMachine completed: ${result.stepCount} instructions.\n` });
            this.event('terminated');
        }
        catch (error) {
            const details = error instanceof Error ? error.message : String(error);
            this.event('output', { category: 'stderr', output: `${details}\n` });
            this.event('output', { category: 'console', output: `ESP32 PMachine failed on ${targetHost}: ${details}\n` });
            this.event('terminated');
        }
    }
    // Deploys the program and opens the paused session through the backend
    // deployment API, which owns the FFS upload and talks to the board for us.
    async startEsp32DebugSessionViaApi(targetHost, pcodePath) {
        try {
            const pcode = this.runtime.artifact.pcodeText;
            const programMap = { ...this.runtime.artifact.programMap };
            delete programMap.sourceMap;
            const response = await fetch(`${this.debugApiUrl}/api/pmachine/debug/esp32/session`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    host: targetHost,
                    pcode,
                    pcodeFile: pcodePath,
                    programMap,
                    startPc: pcodeLabelAddress(pcode, String(this.runtime.artifact.programMap?.entryLabel || 'MAIN')),
                    breakpoints: this.remoteBreakpointAddresses(),
                }),
                signal: AbortSignal.timeout(30000),
            });
            const text = await response.text();
            if (!response.ok)
                throw new Error(`deployment API session failed (${response.status}): ${text}`);
            const payload = JSON.parse(text);
            this.remoteSessionId = String(payload.session?.sessionId || '');
            if (!this.remoteSessionId)
                throw new Error('deployment API returned no sessionId');
            this.sessionId = this.remoteSessionId;
            this.state = await this.readEsp32State();
            await this.waitForEsp32Stop('entry');
        }
        catch (error) {
            const details = error instanceof Error ? error.message : String(error);
            this.event('output', { category: 'stderr', output: `${details}\n` });
            this.event('terminated');
        }
    }
    async remoteRequest(endpoint, init = {}) {
        if (this.debugApiUrl)
            return this.debugApiRequest(endpoint, init);
        const response = await fetch(`${this.remoteBaseUrl}${endpoint}`, { ...init, signal: AbortSignal.timeout(15000) });
        const text = await response.text();
        if (!response.ok)
            throw new Error(`ESP32 request failed (${response.status}): ${text}`);
        if (!text)
            return {};
        try {
            return JSON.parse(text);
        }
        catch {
            return text;
        }
    }
    // Translates the on-device session endpoints to their deployment API
    // equivalents so both transports share the rest of the adapter logic.
    async debugApiRequest(endpoint, init) {
        const method = String(init.method || 'GET').toUpperCase();
        const action = endpoint.match(/\/pmachine\/debug\/session\/([a-z-]+)/i)?.[1] || '';
        const base = `${this.debugApiUrl}/api/pmachine/debug/esp32/session`;
        const query = `host=${encodeURIComponent(this.debugApiHost)}&sessionId=${encodeURIComponent(this.remoteSessionId)}`;
        const request = action
            ? {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ host: this.debugApiHost, sessionId: this.remoteSessionId }),
            }
            : { method };
        const url = action ? `${base}/${action}` : `${base}?${query}`;
        const response = await fetch(url, { ...request, signal: AbortSignal.timeout(15000) });
        const text = await response.text();
        if (!response.ok)
            throw new Error(`deployment API request failed (${response.status}): ${text}`);
        if (!text)
            return {};
        const payload = JSON.parse(text);
        return payload.state || payload;
    }
    remoteBreakpointAddresses() {
        const entries = Object.entries(this.remoteSourceMap)
            .map(([address, location]) => ({ address: Number(address), line: Number(location?.sourceLine) }))
            .filter(item => Number.isInteger(item.address) && Number.isInteger(item.line) && item.line > 0)
            .sort((left, right) => left.address - right.address);
        const addresses = new Set();
        for (const breakpoint of this.breakpoints) {
            const candidates = entries.filter(item => item.line >= breakpoint.line);
            const selected = candidates[0] || [...entries].reverse().find(item => item.line < breakpoint.line);
            if (selected)
                addresses.add(selected.address);
        }
        return [...addresses].sort((left, right) => left - right);
    }
    async readEsp32State() {
        const response = await this.remoteRequest(`/pmachine/debug/session?id=${encodeURIComponent(this.remoteSessionId)}`);
        const pc = Number(response.pc || 0);
        const sourceLocation = this.remoteSourceMap[String(pc)] || {};
        return {
            ...response,
            status: response.status,
            pc,
            sourceLocation: { ...sourceLocation, sourceFile: this.runtime?.program },
            globals: response.globals || {},
            locals: response.locals || {},
        };
    }
    async waitForEsp32Stop(reason) {
        for (let index = 0; index < 3000; index += 1) {
            await new Promise(resolve => setTimeout(resolve, 10));
            this.state = await this.readEsp32State();
            if (this.state.status === 'paused') {
                this.event('stopped', { reason, threadId: this.threadId });
                return;
            }
            if (this.state.status === 'stopped') {
                this.event('terminated');
                return;
            }
        }
        throw new Error('Timed out waiting for the ESP32 PMachine debug session.');
    }
    async continueEsp32() {
        await this.remoteRequest(`/pmachine/debug/session/continue?id=${encodeURIComponent(this.remoteSessionId)}`, { method: 'POST' });
        await this.waitForEsp32Stop('breakpoint');
    }
    async advanceEsp32Instruction() {
        const previousPc = Number(this.state?.pc || 0);
        const previousDepth = Number(this.state?.callDepth || 0);
        await this.remoteRequest(`/pmachine/debug/session/step?id=${encodeURIComponent(this.remoteSessionId)}`, { method: 'POST' });
        for (let index = 0; index < 3000; index += 1) {
            await new Promise(resolve => setTimeout(resolve, 10));
            this.state = await this.readEsp32State();
            if (this.state.status === 'stopped') {
                this.event('terminated');
                return;
            }
            if (this.state.status === 'paused' && (Number(this.state.pc) !== previousPc
                || Number(this.state.callDepth) !== previousDepth || index >= 1))
                return;
        }
        throw new Error('Timed out waiting for the ESP32 PMachine step.');
    }
    async stepEsp32(mode) {
        const action = mode === 'step-out' ? 'stepout' : 'step';
        await this.remoteRequest(`/pmachine/debug/session/${action}?id=${encodeURIComponent(this.remoteSessionId)}`, { method: 'POST' });
        await this.waitForEsp32Stop(mode === 'step-out' ? 'step' : 'step');
        this.state = await this.readEsp32State();
        this.event('stopped', { reason: 'step', threadId: this.threadId });
    }
    async setBreakpoints(request, argumentsValue) {
        const sourcePath = path.resolve(String(argumentsValue.source?.path || this.runtime?.program || ''));
        const requested = Array.isArray(argumentsValue.breakpoints) ? argumentsValue.breakpoints : [];
        this.breakpoints.splice(0, this.breakpoints.length, ...requested.map((item) => ({
            line: Number(item.line),
            sourcePath,
        })).filter((item) => Number.isInteger(item.line)));
        if (this.sessionId)
            await this.applyBreakpoints();
        this.respond(request, true, {
            breakpoints: this.breakpoints.map((item) => ({ verified: true, line: item.line })),
        });
    }
    async applyBreakpoints() {
        const sourceFile = path.basename(this.runtime.program);
        const lines = this.breakpoints.map((item) => item.line);
        if (!this.reachedEntry && this.entryLine > 0 && !lines.includes(this.entryLine))
            lines.push(this.entryLine);
        this.state = this.debug.setJavaScriptPmachineSourceBreakpoints(this.sessionId, lines.map((line) => ({
            sourceFile,
            sourceLanguage: this.runtime.language,
            sourceLine: line,
        })));
    }
    // Start always halts on the program entry line so the standard debug buttons drive execution from there.
    async stopAtProgramEntry() {
        if (this.remoteEsp32) {
            await this.startEsp32DebugSession();
            this.reachedEntry = true;
            return;
        }
        await this.resumeUntilPause('continue');
        this.reachedEntry = true;
        await this.applyBreakpoints();
    }
    async resumeUntilPause(action) {
        if (action === 'step-over')
            this.state = this.debug.stepOverJavaScriptPmachineDebugSession(this.sessionId);
        else if (action === 'step-in')
            this.state = this.debug.stepJavaScriptPmachineDebugSession(this.sessionId);
        else
            this.state = this.debug.continueJavaScriptPmachineDebugSession(this.sessionId);
        for (let index = 0; index < 1500; index += 1) {
            await new Promise((resolve) => setTimeout(resolve, 10));
            this.state = this.debug.getJavaScriptPmachineDebugState(this.sessionId);
            this.forwardOutput();
            if (!this.state || this.state.status === 'paused') {
                this.event('stopped', { reason: action === 'continue' ? 'breakpoint' : 'step', threadId: this.threadId });
                return;
            }
            if (this.state.status === 'completed' || this.state.status === 'error') {
                if (this.state.status === 'error') {
                    this.event('output', { category: 'stderr', output: `${this.state.error}\n` });
                }
                else {
                    this.forwardOutput(this.state.result?.stdout || []);
                }
                this.event('terminated');
                return;
            }
        }
        throw new Error('Timed out waiting for PMachine debug state.');
    }
    async stepToNextSource(action) {
        const origin = this.sourceKey(this.state?.sourceLocation);
        const savedBreakpoints = [...(this.state?.breakpoints || [])];
        this.state = this.debug.setJavaScriptPmachineDebugBreakpoints(this.sessionId, []);
        for (let index = 0; index < 5000; index += 1) {
            if (action === 'step-over' && index === 0) {
                this.state = this.debug.stepOverJavaScriptPmachineDebugSession(this.sessionId);
            }
            else {
                this.state = this.debug.stepJavaScriptPmachineDebugSession(this.sessionId);
            }
            for (let wait = 0; wait < 1500; wait += 1) {
                await new Promise((resolve) => setTimeout(resolve, 10));
                this.state = this.debug.getJavaScriptPmachineDebugState(this.sessionId);
                this.forwardOutput();
                if (!this.state || this.state.status === 'paused' || this.state.status === 'completed' || this.state.status === 'error')
                    break;
            }
            if (!this.state || this.state.status === 'completed' || this.state.status === 'error') {
                if (this.state?.status === 'error')
                    this.event('output', { category: 'stderr', output: `${this.state.error}\n` });
                this.event(this.state?.status === 'error' ? 'output' : 'terminated', this.state?.status === 'error' ? {} : {});
                return;
            }
            const nextSourceKey = this.sourceKey(this.state.sourceLocation);
            const hasSourceLine = Number(this.state.sourceLocation?.sourceLine) > 0;
            if (hasSourceLine && nextSourceKey !== origin) {
                this.state = this.debug.setJavaScriptPmachineDebugBreakpoints(this.sessionId, savedBreakpoints);
                this.event('stopped', { reason: 'step', threadId: this.threadId });
                return;
            }
        }
        this.debug.setJavaScriptPmachineDebugBreakpoints(this.sessionId, savedBreakpoints);
        throw new Error('Timed out waiting for the next source statement.');
    }
    async animateSource() {
        this.event('output', { category: 'console', output: `Animating source every ${this.animationDelayMs}ms.\n` });
        while (!this.terminated) {
            await new Promise((resolve) => setTimeout(resolve, this.animationDelayMs));
            if (this.terminated)
                return;
            if (this.remoteEsp32)
                await this.stepEsp32('step-in');
            else
                await this.stepToNextSource('step-in');
            if (this.terminated)
                return;
            this.reportVariables();
        }
    }
    reportVariables() {
        const location = this.state?.sourceLocation;
        const values = { ...(this.state?.globals || {}), ...(this.state?.locals || {}) };
        const rendered = Object.entries(values).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join(', ');
        this.event('output', {
            category: 'console',
            output: `line ${Number(location?.sourceLine || 0)}: ${String(location?.sourceText || '').trim()}${rendered ? `  | ${rendered}` : ''}\n`,
        });
    }
    sourceKey(location) {
        return `${location?.sourceFile || ''}:${Number(location?.sourceLine || 0)}`;
    }
    stackFrame() {
        const location = this.state?.sourceLocation;
        const sourcePath = this.runtime?.program || location?.sourceFile || '';
        return {
            id: 1,
            name: location?.sourceText || 'PMachine instruction',
            line: Number(location?.sourceLine || 1),
            column: 1,
            source: { name: path.basename(sourcePath), path: sourcePath },
        };
    }
    variables(reference) {
        const values = reference === 1 ? this.state?.globals : this.state?.locals;
        return Object.entries(values || {}).map(([name, value]) => ({ name, value: JSON.stringify(value), variablesReference: 0 }));
    }
    forwardOutput(completedOutput = []) {
        const stdout = Array.isArray(this.state?.stdout) ? this.state.stdout : completedOutput;
        for (const line of stdout.slice(this.emittedOutputCount)) {
            this.emitProgramOutput(line);
        }
        this.emittedOutputCount = stdout.length;
    }
    emitProgramOutput(line) {
        this.event('output', { category: 'console', output: `${String(line)}\n` });
    }
    evaluate(request) {
        const name = String(request.arguments?.expression || '').trim();
        const values = { ...(this.state?.globals || {}), ...(this.state?.locals || {}) };
        if (!Object.prototype.hasOwnProperty.call(values, name)) {
            this.respond(request, false, undefined, `Unknown PMachine variable '${name}'.`);
            return;
        }
        this.respond(request, true, { result: JSON.stringify(values[name]), variablesReference: 0 });
    }
}
class PulseDebugFactory {
    extensionUri;
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
    }
    createDebugAdapterDescriptor(session) {
        return new vscode.DebugAdapterInlineImplementation(new PulsePmachineAdapter(session.configuration));
    }
}
export function activate(context) {
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('pulse-pmachine', new PulseDebugFactory(context.extensionUri)));
}
export function deactivate() { }
//# sourceMappingURL=extension.js.map