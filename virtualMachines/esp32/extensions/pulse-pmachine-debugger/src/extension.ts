import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as vscode from 'vscode';
import { DebugProtocol } from '@vscode/debugprotocol';
import { HanoiPanel, looksLikeHanoi } from './hanoiPanel.js';
import { ServicesViewProvider, openServiceEndpoint } from './servicesView.js';

const DEFAULT_NODE_HOSTS = ['127.0.0.1:4111', '127.0.0.1:4112', '127.0.0.1:4113', '192.168.2.155'];

function isRemoteRuntime(runtime: unknown): boolean {
  return runtime === 'esp32' || runtime === 'js-node';
}

function defaultTargetHost(runtime: unknown): string {
  return runtime === 'js-node' ? '127.0.0.1:4111' : '192.168.2.155';
}

type RuntimeState = any;

type Breakpoint = {
  line: number;
  sourcePath: string;
};

function languageForFile(filePath: string): string {
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

function findProgramEntryLine(source: string): number {
  const lines = source.split(/\r?\n/);
  const blockStarts: number[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const withoutStrings = lines[index].replace(/'(?:''|[^'])*'/g, "''");
    const withoutComments = withoutStrings.replace(/\/\/.*$/, '').replace(/\{.*?\}/g, '');
    const tokens = /\b(begin|end)\b/gi;
    let match: RegExpExecArray | null;
    while ((match = tokens.exec(withoutComments)) !== null) {
      if (match[1].toLowerCase() === 'begin') {
        blockStarts.push(index + 1);
      } else if (blockStarts.length > 0) {
        const startLine = blockStarts.pop() as number;
        if (/\bend\s*\.\s*$/i.test(withoutComments) && blockStarts.length === 0) {
          return startLine;
        }
      }
    }
  }
  return blockStarts[0] || 1;
}

function pcodeLabelAddress(pcodeText: string, label: string): number {
  let address = 0;
  for (const rawLine of pcodeText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.endsWith(':')) {
      if (line.slice(0, -1) === label) return address;
      continue;
    }
    address += 1;
  }
  return 0;
}

class PulsePmachineAdapter implements vscode.DebugAdapter {
  private readonly messages = new vscode.EventEmitter<DebugProtocol.ProtocolMessage>();
  readonly onDidSendMessage = this.messages.event;
  private readonly breakpoints: Breakpoint[] = [];
  private runtime: any;
  private debug: any;
  private sessionId = '';
  private state: RuntimeState = null;
  private threadId = 1;
  private root: string;
  private emittedOutputCount = 0;
  private animate = false;
  private launchDone: Promise<void> = Promise.resolve();
  private animationDelayMs = 500;
  private remoteEsp32 = false;
  private remoteBaseUrl = '';
  private remoteSessionId = '';
  private debugApiUrl = '';
  private debugApiHost = '';
  private remoteSourceMap: Record<string, any> = {};
  private remoteBreakpoints: number[] = [];
  private bridge: any = null;
  private entryLine = 0;
  private reachedEntry = false;
  private terminated = false;
  private readonly pendingRequests = new Set<number>();

  constructor(private readonly configuration: any) {
    this.root = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(configuration.program || ''))?.uri.fsPath
      || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      || process.cwd();
  }

  dispose(): void {
    if (this.remoteSessionId) {
      void this.remoteRequest(`/pmachine/debug/session?id=${encodeURIComponent(this.remoteSessionId)}`, { method: 'DELETE' }).catch(() => undefined);
    } else if (this.sessionId && this.debug) {
      this.debug.stopJavaScriptPmachineDebugSession(this.sessionId);
    }
    this.messages.dispose();
  }

  handleMessage(message: DebugProtocol.ProtocolMessage): void {
    if (message.type !== 'request') return;
    this.pendingRequests.add(message.seq);
    void this.handleRequest(message as DebugProtocol.Request).catch((error) => {
      const details = error?.message || String(error);
      if (this.pendingRequests.has(message.seq)) this.respond(message as DebugProtocol.Request, false, undefined, details);
      else this.event('output', { category: 'stderr', output: `${details}\n` });
    });
  }

  private send(message: DebugProtocol.ProtocolMessage): void {
    this.messages.fire(message);
  }

  private respond(request: DebugProtocol.Request, success = true, body: any = {}, message?: string): void {
    this.pendingRequests.delete(request.seq);
    this.send({
      type: 'response',
      seq: 0,
      request_seq: request.seq,
      command: request.command,
      success,
      body,
      message,
    } as DebugProtocol.Response);
  }

  private event(event: string, body: any = {}): void {
    if (event === 'terminated') this.terminated = true;
    this.send({ type: 'event', seq: 0, event, body } as DebugProtocol.Event);
    if (event === 'stopped' || event === 'terminated') this.sendPulseState(event === 'terminated' ? 'terminated' : 'paused');
  }

  // Custom events feed the Hanoi animation webview owned by the extension host.
  private sendPulseState(status: string): void {
    const location = this.state?.sourceLocation;
    this.send({ type: 'event', seq: 0, event: 'pulseState', body: {
      status,
      line: Number(location?.sourceLine || 0),
      sourceText: String(location?.sourceText || '').trim(),
      globals: this.state?.globals || {},
      locals: this.state?.locals || {},
      callDepth: Number(this.state?.callDepth ?? this.state?.callStack?.length ?? 0),
    } } as DebugProtocol.Event);
  }

  private wantsRemoteDebugSession(): boolean {
    return this.configuration.debugSession === true || this.configuration.animate === true;
  }

  private async handleRequest(request: DebugProtocol.Request): Promise<void> {
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
        this.launchDone = this.launch(request.arguments || {});
        await this.launchDone;
        this.respond(request);
        return;
      case 'setBreakpoints':
        await this.setBreakpoints(request, request.arguments || {});
        return;
      case 'configurationDone':
        // VS Code may send configurationDone before the launch request has finished compiling.
        await this.launchDone;
        this.respond(request);
        if (this.remoteEsp32 && !this.wantsRemoteDebugSession()) {
          await this.runEsp32Source();
          return;
        }
        await this.stopAtProgramEntry();
        if (this.animate) void this.animateSource();
        return;
      case 'threads':
        this.respond(request, true, { threads: [{ id: this.threadId, name: this.remoteEsp32
          ? `${this.configuration.runtime === 'js-node' ? 'JS PMachine node' : 'ESP32 PMachine'} ${this.debugApiHost || this.configuration.targetHost || ''}`.trim()
          : 'JS PMachine' }] });
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
        if (this.remoteEsp32) await this.continueEsp32();
        else await this.resumeUntilPause('continue');
        return;
      case 'next':
        this.respond(request);
        if (this.remoteEsp32) await this.stepEsp32('step-over');
        else await this.stepToNextSource('step-over');
        return;
      case 'stepIn':
        this.respond(request);
        if (this.remoteEsp32) await this.stepEsp32('step-in');
        else await this.stepToNextSource('step-in');
        return;
      case 'stepOut':
        this.respond(request);
        if (this.remoteEsp32) await this.stepEsp32('step-out');
        else await this.stepToNextSource('step-out');
        return;
      case 'pause':
        this.respond(request);
        if (this.remoteEsp32) {
          await this.remoteRequest(`/pmachine/debug/session/pause?id=${encodeURIComponent(this.remoteSessionId)}`, { method: 'POST' });
          await this.waitForEsp32Stop('pause');
        } else {
          this.state = this.debug.pauseJavaScriptPmachineDebugSession(this.sessionId);
          this.event('stopped', { reason: 'pause', threadId: this.threadId });
        }
        return;
      case 'disconnect':
      case 'terminate':
        if (this.remoteSessionId) {
          await this.remoteRequest(`/pmachine/debug/session?id=${encodeURIComponent(this.remoteSessionId)}`, { method: 'DELETE' });
          this.remoteSessionId = '';
        } else if (this.sessionId && this.debug) {
          this.debug.stopJavaScriptPmachineDebugSession(this.sessionId);
        }
        this.respond(request);
        this.event('terminated');
        return;
      default:
        this.respond(request, false, undefined, `Unsupported request: ${request.command}`);
    }
  }

  private async launch(configuration: any): Promise<void> {
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
    this.remoteEsp32 = isRemoteRuntime(configuration.runtime);
    this.entryLine = Number(configuration.breakpointLine) || findProgramEntryLine(source);
    this.event('output', { category: 'console', output: `Program entry at source line ${this.entryLine}.\n` });
    this.send({ type: 'event', seq: 0, event: 'pulseLaunch', body: {
      program,
      isHanoi: looksLikeHanoi(source, program),
      target: this.remoteEsp32 ? String(configuration.targetHost || defaultTargetHost(configuration.runtime)) : 'local JS PMachine',
      showAnimation: configuration.showAnimation === true,
    } } as DebugProtocol.Event);
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

  private async startEsp32DebugSession(): Promise<void> {
    const configuration = this.configuration;
    const targetHost = String(configuration.targetHost || defaultTargetHost(configuration.runtime));
    const fileserverUrl = String(configuration.fileserverUrl || 'http://192.168.2.11:4015').replace(/\/$/, '');
    const tag = `vscode-${Date.now().toString(36)}`;
    const pcodePath = `/vscode-${tag}.pcode`;
    this.debugApiUrl = String(configuration.debugApiUrl || '').replace(/\/$/, '');
    this.debugApiHost = targetHost;
    if (this.debugApiUrl) {
      await this.startEsp32DebugSessionViaApi(targetHost, pcodePath);
      return;
    }
    if (configuration.uploadMode !== 'shared') {
      await this.startEsp32DebugSessionViaBridge(targetHost);
      return;
    }
    try {
      const pcode = this.runtime.artifact.pcodeText;
      const mapPath = `${pcodePath}.map.json`;
      const { attachPcodeSignature } = await import(pathToFileURL(path.join(this.root, 'aggregator', 'scripts', 'pcode-signing.mjs')).href);
      const remoteProgramMap = { ...this.runtime.artifact.programMap };
      delete remoteProgramMap.sourceMap;
      const programMap = JSON.stringify(attachPcodeSignature(remoteProgramMap, pcode));
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
      if (!publish.ok) throw new Error(`${uploadMode} FFS upload failed (${publish.status}): ${await publish.text()}`);
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
        if (!mount.ok) throw new Error(`ESP32 FFS mount failed (${mount.status}): ${await mount.text()}`);
      }

      const startPc = pcodeLabelAddress(pcode, String(this.runtime.artifact.programMap?.entryLabel || 'MAIN'));
      const breakpointPcs = this.remoteBreakpointAddresses();
      const params = new URLSearchParams({
        file: pcodePath,
        programMap: mapPath,
        max: String(Math.max(32768, pcode.length * 2)),
        startPc: String(startPc),
        breakpoints: breakpointPcs.join(','),
      });
      const response = await fetch(`${this.remoteBaseUrl}/pmachine/debug/session?${params}`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error(`ESP32 debug session failed (${response.status}): ${await response.text()}`);
      const session = await response.json() as { sessionId: string };
      this.remoteSessionId = session.sessionId;
      this.sessionId = session.sessionId;
      this.remoteBreakpoints = breakpointPcs;
      this.state = await this.readEsp32State();
      await this.waitForEsp32Stop('entry');
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.event('output', { category: 'stderr', output: `${details}\n` });
      this.event('output', { category: 'console', output: `ESP32 PMachine failed on ${targetHost}: ${details}\n` });
      this.event('terminated');
    }
  }

  private async runEsp32Source(): Promise<void> {
    const configuration = this.configuration;
    const targetHost = String(configuration.targetHost || defaultTargetHost(configuration.runtime));
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
        if (!publish.ok) throw new Error(`${uploadMode} FFS upload failed (${publish.status}): ${await publish.text()}`);
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
        if (!mount.ok) throw new Error(`ESP32 FFS mount failed (${mount.status}): ${await mount.text()}`);
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
      if (!execute.ok) throw new Error(`ESP32 PMachine failed (${execute.status}): ${resultText}`);
      const result = JSON.parse(resultText);
      this.event('output', { category: 'console', output: `${JSON.stringify({ targetHost, result }, null, 2)}\n` });
      const output = Array.isArray(result.stdout) ? result.stdout : [];
      for (const line of output) {
        this.emitProgramOutput(line);
        if (this.animate) await new Promise(resolve => setTimeout(resolve, this.animationDelayMs));
      }
      this.event('output', { category: 'console', output: `ESP32 PMachine completed: ${result.stepCount} instructions.\n` });
      this.event('terminated');
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.event('output', { category: 'stderr', output: `${details}\n` });
      this.event('output', { category: 'console', output: `ESP32 PMachine failed on ${targetHost}: ${details}\n` });
      this.event('terminated');
    }
  }

  // Deploys the program and opens the paused session through the backend
  // deployment API, which owns the FFS upload and talks to the board for us.
  private async startEsp32DebugSessionViaApi(targetHost: string, pcodePath: string): Promise<void> {
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
      if (!response.ok) throw new Error(`deployment API session failed (${response.status}): ${text}`);
      const payload = JSON.parse(text) as { session?: { sessionId?: string } };
      this.remoteSessionId = String(payload.session?.sessionId || '');
      if (!this.remoteSessionId) throw new Error('deployment API returned no sessionId');
      this.sessionId = this.remoteSessionId;
      this.remoteBreakpoints = this.remoteBreakpointAddresses();
      this.state = await this.readEsp32State();
      await this.waitForEsp32Stop('entry');
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.event('output', { category: 'stderr', output: `${details}\n` });
      this.event('terminated');
    }
  }

  // Drives the device through the shared debug bridge in-process. The bridge
  // supplies source-line stepping plus a shadow trace for stdout/call stack on
  // firmware that does not report them, and works for ESP32 and JS nodes alike.
  private async startEsp32DebugSessionViaBridge(targetHost: string): Promise<void> {
    try {
      this.bridge = await import(pathToFileURL(path.join(this.root, 'aggregator', 'src', 'backend', 'modules', 'esp32PmachineDebugBridge.mjs')).href);
      const pcode = this.runtime.artifact.pcodeText;
      const breakpoints = this.remoteBreakpointAddresses();
      const session = await this.bridge.startEsp32DebugSession({
        host: targetHost,
        pcode,
        programMap: this.runtime.artifact.programMap,
        startPc: pcodeLabelAddress(pcode, String(this.runtime.artifact.programMap?.entryLabel || 'MAIN')),
        breakpoints,
      });
      this.remoteSessionId = String(session.sessionId || '');
      if (!this.remoteSessionId) throw new Error('pmachine returned no sessionId');
      this.sessionId = this.remoteSessionId;
      this.remoteBreakpoints = breakpoints;
      this.event('output', { category: 'console', output: `Debug session ${this.remoteSessionId} on ${targetHost}.\n` });
      this.state = await this.readEsp32State();
      if (this.state.status === 'paused' && !this.state.sourceLocation?.sourceLine) {
        await this.bridge.controlEsp32DebugSession({ host: targetHost, sessionId: this.remoteSessionId, action: 'line-step-in' });
      }
      await this.waitForEsp32Stop('entry');
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.event('output', { category: 'stderr', output: `PMachine on ${targetHost} failed: ${details}\n` });
      this.event('terminated');
    }
  }

  private async bridgeRequest(endpoint: string, init: RequestInit): Promise<any> {
    const method = String(init.method || 'GET').toUpperCase();
    const url = new URL(endpoint, 'http://pmachine');
    const target = { host: this.debugApiHost, sessionId: this.remoteSessionId };
    if (method === 'DELETE') return this.bridge.stopEsp32DebugSession(target);
    const breakpointAction = url.pathname.match(/\/breakpoint\/(set|clear)$/)?.[1];
    if (breakpointAction) {
      return this.bridge.controlEsp32DebugSession({ ...target, action: `breakpoint-${breakpointAction}`, pc: Number(url.searchParams.get('pc')) });
    }
    const action = url.pathname.match(/\/pmachine\/debug\/session\/([a-z-]+)$/i)?.[1];
    if (action) return this.bridge.controlEsp32DebugSession({ ...target, action });
    return this.bridge.readEsp32DebugSession(target);
  }

  private async remoteRequest(endpoint: string, init: RequestInit = {}): Promise<any> {
    if (this.bridge) return this.bridgeRequest(endpoint, init);
    if (this.debugApiUrl) return this.debugApiRequest(endpoint, init);
    const response = await fetch(`${this.remoteBaseUrl}${endpoint}`, { ...init, signal: AbortSignal.timeout(15000) });
    const text = await response.text();
    if (!response.ok) throw new Error(`ESP32 request failed (${response.status}): ${text}`);
    if (!text) return {};
    try { return JSON.parse(text); } catch { return text; }
  }

  // Translates the on-device session endpoints to their deployment API
  // equivalents so both transports share the rest of the adapter logic.
  private async debugApiRequest(endpoint: string, init: RequestInit): Promise<any> {
    const method = String(init.method || 'GET').toUpperCase();
    const deviceUrl = new URL(endpoint, 'http://pmachine');
    const breakpointAction = deviceUrl.pathname.match(/\/breakpoint\/(set|clear)$/)?.[1];
    const action = breakpointAction
      ? `breakpoint-${breakpointAction}`
      : deviceUrl.pathname.match(/\/pmachine\/debug\/session\/([a-z-]+)/i)?.[1] || '';
    const base = `${this.debugApiUrl}/api/pmachine/debug/esp32/session`;
    const query = `host=${encodeURIComponent(this.debugApiHost)}&sessionId=${encodeURIComponent(this.remoteSessionId)}`;
    const request: RequestInit = action
      ? {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          host: this.debugApiHost,
          sessionId: this.remoteSessionId,
          ...(breakpointAction ? { pc: Number(deviceUrl.searchParams.get('pc')) } : {}),
        }),
      }
      : { method };
    const url = action ? `${base}/${action}` : `${base}?${query}`;
    const response = await fetch(url, { ...request, signal: AbortSignal.timeout(15000) });
    const text = await response.text();
    if (!response.ok) throw new Error(`deployment API request failed (${response.status}): ${text}`);
    if (!text) return {};
    const payload = JSON.parse(text);
    return payload.state || payload;
  }

  private remoteBreakpointAddresses(): number[] {
    const entries = Object.entries(this.remoteSourceMap)
      .map(([address, location]) => ({ address: Number(address), line: Number(location?.sourceLine) }))
      .filter(item => Number.isInteger(item.address) && Number.isInteger(item.line) && item.line > 0)
      .sort((left, right) => left.address - right.address);
    const addresses = new Set<number>();
    for (const breakpoint of this.breakpoints) {
      const candidates = entries.filter(item => item.line >= breakpoint.line)
        .sort((left, right) => left.line - right.line || left.address - right.address);
      const selected = candidates[0];
      if (selected) addresses.add(selected.address);
    }
    return [...addresses].sort((left, right) => left - right);
  }

  private async readEsp32State(): Promise<RuntimeState> {
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

  private async waitForEsp32Stop(reason: 'entry' | 'breakpoint' | 'step' | 'pause', emitStop = true): Promise<void> {
    for (let index = 0; index < 3000; index += 1) {
      await new Promise(resolve => setTimeout(resolve, 10));
      this.state = await this.readEsp32State();
      this.forwardOutput();
      if (this.state.status === 'paused') {
        if (emitStop) this.event('stopped', { reason, threadId: this.threadId });
        return;
      }
      if (this.state.status === 'stopped') {
        this.event('terminated');
        return;
      }
    }
    throw new Error('Timed out waiting for the ESP32 PMachine debug session.');
  }

  private async continueEsp32(): Promise<void> {
    await this.remoteRequest(`/pmachine/debug/session/continue?id=${encodeURIComponent(this.remoteSessionId)}`, { method: 'POST' });
    await this.waitForEsp32Stop('breakpoint');
  }

  private async advanceEsp32Instruction(): Promise<void> {
    const previousPc = Number(this.state?.pc || 0);
    const previousDepth = Number(this.state?.callDepth || 0);
    await this.remoteRequest(`/pmachine/debug/session/step?id=${encodeURIComponent(this.remoteSessionId)}`, { method: 'POST' });
    for (let index = 0; index < 3000; index += 1) {
      await new Promise(resolve => setTimeout(resolve, 10));
      this.state = await this.readEsp32State();
      this.forwardOutput();
      if (this.state.status === 'stopped') {
        this.event('terminated');
        return;
      }
      if (this.state.status === 'paused' && (Number(this.state.pc) !== previousPc
        || Number(this.state.callDepth) !== previousDepth)) return;
    }
    throw new Error('Timed out waiting for the ESP32 PMachine step.');
  }

  private async stepEsp32(mode: 'step-in' | 'step-over' | 'step-out'): Promise<void> {
    if (this.bridge) {
      await this.bridge.controlEsp32DebugSession({ host: this.debugApiHost, sessionId: this.remoteSessionId, action: `line-${mode}` });
      this.state = await this.readEsp32State();
      this.forwardOutput();
      if (this.state.status === 'stopped') {
        this.event('terminated');
        return;
      }
      const reason = this.remoteBreakpoints.includes(Number(this.state.pc)) ? 'breakpoint' : 'step';
      this.event('stopped', { reason, threadId: this.threadId });
      return;
    }
    const origin = this.sourceKey(this.state?.sourceLocation);
    const depth = Number(this.state?.callDepth || 0);
    if (mode === 'step-out' && depth > 0) {
      await this.remoteRequest(`/pmachine/debug/session/stepout?id=${encodeURIComponent(this.remoteSessionId)}`, { method: 'POST' });
      await this.waitForEsp32Stop('step', false);
      if (this.terminated) return;
      this.event('stopped', { reason: 'step', threadId: this.threadId });
      return;
    }
    const instructions = String(this.runtime?.artifact?.pcodeText || '').split(/\r?\n/)
      .map(line => line.trim()).filter(line => line && !line.startsWith('#') && !line.endsWith(':'));
    for (let index = 0; index < 5000; index += 1) {
      const pc = Number(this.state?.pc || 0);
      if (mode === 'step-over' && /^CALL\s/.test(instructions[pc] || '')) {
        const returnPc = pc + 1;
        const temporary = !this.remoteBreakpoints.includes(returnPc);
        if (temporary) await this.remoteRequest(`/pmachine/debug/session/breakpoint/set?id=${encodeURIComponent(this.remoteSessionId)}&pc=${returnPc}`, { method: 'POST' });
        try {
          await this.remoteRequest(`/pmachine/debug/session/continue?id=${encodeURIComponent(this.remoteSessionId)}`, { method: 'POST' });
          await this.waitForEsp32Stop('step', false);
        } finally {
          if (temporary) await this.remoteRequest(`/pmachine/debug/session/breakpoint/clear?id=${encodeURIComponent(this.remoteSessionId)}&pc=${returnPc}`, { method: 'POST' });
        }
      } else {
        await this.advanceEsp32Instruction();
      }
      if (this.terminated) return;
      const nextDepth = Number(this.state?.callDepth || 0);
      const changedSource = Number(this.state?.sourceLocation?.sourceLine) > 0
        && (this.sourceKey(this.state?.sourceLocation) !== origin || nextDepth !== depth);
      if (changedSource && this.remoteBreakpoints.includes(Number(this.state.pc))) {
        this.event('stopped', { reason: 'breakpoint', threadId: this.threadId });
        return;
      }
      const stop = mode === 'step-out'
        ? nextDepth < depth || (depth === 0 && changedSource)
        : changedSource && (mode === 'step-in' || nextDepth <= depth);
      if (stop) {
        this.event('stopped', { reason: 'step', threadId: this.threadId });
        return;
      }
    }
    throw new Error('Timed out waiting for the next ESP32 source statement.');
  }

  private async setBreakpoints(request: DebugProtocol.Request, argumentsValue: any): Promise<void> {
    const sourcePath = path.resolve(String(argumentsValue.source?.path || this.runtime?.program || ''));
    const requested = Array.isArray(argumentsValue.breakpoints) ? argumentsValue.breakpoints : [];
    this.breakpoints.splice(0, this.breakpoints.length, ...requested.map((item: any) => ({
      line: Number(item.line),
      sourcePath,
    })).filter((item: Breakpoint) => Number.isInteger(item.line)));
    if (this.sessionId) await this.applyBreakpoints();
    this.respond(request, true, {
      breakpoints: this.breakpoints.map((item) => ({ verified: true, line: item.line })),
    });
  }

  private async applyBreakpoints(): Promise<void> {
    if (this.remoteEsp32) {
      if (!this.remoteSessionId) return;
      const desired = this.remoteBreakpointAddresses();
      for (const pc of this.remoteBreakpoints.filter(pc => !desired.includes(pc))) {
        await this.remoteRequest(`/pmachine/debug/session/breakpoint/clear?id=${encodeURIComponent(this.remoteSessionId)}&pc=${pc}`, { method: 'POST' });
      }
      for (const pc of desired.filter(pc => !this.remoteBreakpoints.includes(pc))) {
        await this.remoteRequest(`/pmachine/debug/session/breakpoint/set?id=${encodeURIComponent(this.remoteSessionId)}&pc=${pc}`, { method: 'POST' });
      }
      this.remoteBreakpoints = desired;
      return;
    }
    const sourceFile = path.basename(this.runtime.program);
    const lines = this.breakpoints.map((item) => item.line);
    if (!this.reachedEntry && this.entryLine > 0 && !lines.includes(this.entryLine)) lines.push(this.entryLine);
    this.debug.setJavaScriptPmachineDebugBreakpoints(this.sessionId, []);
    this.state = this.debug.setJavaScriptPmachineSourceBreakpoints(this.sessionId, lines.map((line) => ({
      sourceFile,
      sourceLanguage: this.runtime.language,
      sourceLine: line,
    })));
  }

  // Start always halts on the program entry line so the standard debug buttons drive execution from there.
  private async stopAtProgramEntry(): Promise<void> {
    if (this.remoteEsp32) {
      await this.startEsp32DebugSession();
      this.reachedEntry = true;
      return;
    }
    await this.resumeUntilPause('continue');
    this.reachedEntry = true;
    await this.applyBreakpoints();
  }

  private async resumeUntilPause(action: 'continue' | 'step-in' | 'step-over'): Promise<void> {
    if (action === 'step-over') this.state = this.debug.stepOverJavaScriptPmachineDebugSession(this.sessionId);
    else if (action === 'step-in') this.state = this.debug.stepJavaScriptPmachineDebugSession(this.sessionId);
    else this.state = this.debug.continueJavaScriptPmachineDebugSession(this.sessionId);
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
        } else {
          this.forwardOutput(this.state.result?.stdout || []);
        }
        this.event('terminated');
        return;
      }
    }
    throw new Error('Timed out waiting for PMachine debug state.');
  }

  private async stepToNextSource(action: 'step-in' | 'step-over' | 'step-out'): Promise<void> {
    const origin = this.sourceKey(this.state?.sourceLocation);
    const depth = this.state?.callStack?.length || 0;
    const savedBreakpoints = [...(this.state?.breakpoints || [])];
    this.state = this.debug.setJavaScriptPmachineDebugBreakpoints(this.sessionId, []);
    try {
    for (let index = 0; index < 5000; index += 1) {
      if (action === 'step-out' && index === 0 && depth > 0) {
        this.state = this.debug.stepOutJavaScriptPmachineDebugSession(this.sessionId);
      } else if (action === 'step-over') {
        this.state = this.debug.stepOverJavaScriptPmachineDebugSession(this.sessionId);
      } else {
        this.state = this.debug.stepJavaScriptPmachineDebugSession(this.sessionId);
      }

      for (let wait = 0; wait < 1500; wait += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        this.state = this.debug.getJavaScriptPmachineDebugState(this.sessionId);
        this.forwardOutput();
        if (!this.state || this.state.status === 'paused' || this.state.status === 'completed' || this.state.status === 'error') break;
      }

      if (!this.state || this.state.status === 'completed' || this.state.status === 'error') {
        if (this.state?.status === 'error') this.event('output', { category: 'stderr', output: `${this.state.error}\n` });
        this.event('terminated');
        return;
      }

      const nextSourceKey = this.sourceKey(this.state.sourceLocation);
      const hasSourceLine = Number(this.state.sourceLocation?.sourceLine) > 0;
      const nextDepth = this.state.callStack?.length || 0;
      const changedSource = nextSourceKey !== origin || nextDepth !== depth;
      const shouldStop = action === 'step-out' && depth > 0
        ? nextDepth < depth
        : changedSource && (action !== 'step-over' || nextDepth <= depth);
      if (hasSourceLine && shouldStop) {
        this.event('stopped', { reason: 'step', threadId: this.threadId });
        return;
      }
    }
    throw new Error('Timed out waiting for the next source statement.');
    } finally {
      this.debug.setJavaScriptPmachineDebugBreakpoints(this.sessionId, savedBreakpoints);
    }
  }

  private async animateSource(): Promise<void> {
    this.event('output', { category: 'console', output: `Animating source every ${this.animationDelayMs}ms.\n` });
    while (!this.terminated) {
      await new Promise((resolve) => setTimeout(resolve, this.animationDelayMs));
      if (this.terminated) return;
      if (this.remoteEsp32) await this.stepEsp32('step-in');
      else await this.stepToNextSource('step-in');
      if (this.terminated) return;
      this.reportVariables();
    }
  }

  private reportVariables(): void {
    const location = this.state?.sourceLocation;
    const values = { ...(this.state?.globals || {}), ...(this.state?.locals || {}) };
    const rendered = Object.entries(values).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join(', ');
    this.event('output', {
      category: 'console',
      output: `line ${Number(location?.sourceLine || 0)}: ${String(location?.sourceText || '').trim()}${rendered ? `  | ${rendered}` : ''}\n`,
    });
  }

  private sourceKey(location: any): string {
    return `${location?.sourceFile || ''}:${Number(location?.sourceLine || 0)}`;
  }

  private stackFrame(): DebugProtocol.StackFrame {
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

  private variables(reference: number): DebugProtocol.Variable[] {
    const values = reference === 1 ? this.state?.globals : this.state?.locals;
    return Object.entries(values || {}).map(([name, value]) => ({ name, value: JSON.stringify(value), variablesReference: 0 }));
  }

  private forwardOutput(completedOutput: unknown[] = []): void {
    const stdout = Array.isArray(this.state?.stdout) ? this.state.stdout : completedOutput;
    for (const line of stdout.slice(this.emittedOutputCount)) {
      this.emitProgramOutput(line);
    }
    this.emittedOutputCount = stdout.length;
  }

  private emitProgramOutput(line: unknown): void {
    this.event('output', { category: 'console', output: `${String(line)}\n` });
    this.send({ type: 'event', seq: 0, event: 'pulseOutput', body: { line: String(line) } } as DebugProtocol.Event);
  }

  private evaluate(request: DebugProtocol.Request): void {
    const name = String(request.arguments?.expression || '').trim();
    const values = { ...(this.state?.globals || {}), ...(this.state?.locals || {}) };
    if (!Object.prototype.hasOwnProperty.call(values, name)) {
      this.respond(request, false, undefined, `Unknown PMachine variable '${name}'.`);
      return;
    }
    this.respond(request, true, { result: JSON.stringify(values[name]), variablesReference: 0 });
  }
}

class PulseDebugFactory implements vscode.DebugAdapterDescriptorFactory {
  constructor(private readonly extensionUri: vscode.Uri) {}

  createDebugAdapterDescriptor(session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    return new vscode.DebugAdapterInlineImplementation(new PulsePmachineAdapter(session.configuration));
  }
}

type PmachineRunTarget = vscode.QuickPickItem & {
  key: string;
  runtime: 'js' | 'esp32';
  nodeId?: string;
  host?: string;
};

function directNodeTargets(): PmachineRunTarget[] {
  const configured = vscode.workspace.getConfiguration('pulse-pmachine').get<string[]>('nodeHosts', DEFAULT_NODE_HOSTS);
  return (Array.isArray(configured) ? configured : DEFAULT_NODE_HOSTS)
    .map((host) => String(host || '').trim())
    .filter(Boolean)
    .map((host) => {
      const javascript = /:\d+$/.test(host);
      return {
        key: `direct:${host}`,
        label: `${javascript ? 'JS PMachine node' : 'ESP32 PMachine'} ${host}`,
        description: 'direct HTTP',
        runtime: javascript ? 'js' : 'esp32',
        host,
      } as PmachineRunTarget;
    });
}

type CompiledPcodeArtifact = {
  pcodeText: string;
  programMap: Record<string, any>;
};

function pcodeLanguage(document: vscode.TextDocument): 'pascalish' | 'vbish' | 'wfl' | 'mapl' | null {
  const languageId = document.languageId.toLowerCase();
  const extension = path.extname(document.fileName).toLowerCase();
  if (['pascalish', 'pascal'].includes(languageId) || extension === '.pas') return 'pascalish';
  if (languageId === 'vbish' || ['.bas', '.vb', '.vbs'].includes(extension)) return 'vbish';
  if (languageId === 'wfl' || extension === '.wfl') return 'wfl';
  if (languageId === 'mapl' || extension === '.mapl') return 'mapl';
  return null;
}

async function compileDocumentToPcode(document: vscode.TextDocument, hostServices = false): Promise<CompiledPcodeArtifact> {
  const language = pcodeLanguage(document);
  if (!language) throw new Error('This file is not a supported pcode language.');
  const root = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath
    || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) throw new Error('Open the project workspace before compiling a DSL program.');
  const scripts = path.join(root, 'aggregator', 'scripts');
  const sourceText = document.getText();
  const fileName = path.basename(document.fileName);

  if (language === 'pascalish') {
    const compiler = await import(pathToFileURL(path.join(scripts, 'compile-pascalish-program-antlr-to-pcode.mjs')).href);
    return compiler.compilePascalishProgramWithAntlr(sourceText, {
      fileName,
      ...(hostServices ? { hostServices: true } : {}),
    });
  }

  if (language === 'vbish') {
    const compiler = await import(pathToFileURL(path.join(scripts, 'compile-interoperable-language.mjs')).href);
    return compiler.compileVbishToPmachine(sourceText, { fileName });
  }

  if (language === 'wfl') {
    const [dslCompiler, pcodeCompiler] = await Promise.all([
      import(pathToFileURL(path.join(scripts, 'compile-workflow-dsl.mjs')).href),
      import(pathToFileURL(path.join(scripts, 'compile-workflow-to-pcode.mjs')).href),
    ]);
    const workflowSet = dslCompiler.compileWorkflowDSL(sourceText);
    const workflow = workflowSet.workflows?.[0];
    if (!workflow) throw new Error('No workflow found to compile.');
    const artifact = pcodeCompiler.compileWorkflowToPcode(workflowSet, workflow.id, { sourceText, fileName });
    return {
      pcodeText: artifact.pcodeText,
      programMap: {
        version: 1,
        serviceId: `wfl-${workflow.id}`,
        sourceLanguage: 'wfl',
        runtimeUnit: { kind: 'program', id: workflow.id, refreshMs: null },
        entries: [],
        sourceMap: artifact.sourceMap || {},
      },
    };
  }

  const compiler = await import(pathToFileURL(path.join(scripts, 'compile-mapl-antlr-to-pcode.mjs')).href);
  const artifact = compiler.compileMaplWithAntlr(sourceText);
  return { pcodeText: artifact.pcodeText, programMap: artifact.programMap };
}

async function compileForTarget(document: vscode.TextDocument, target: PmachineRunTarget): Promise<CompiledPcodeArtifact> {
  if (!target.host || pcodeLanguage(document) !== 'pascalish') return compileDocumentToPcode(document);
  try {
    return await compileDocumentToPcode(document, true);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (!detail.includes('Hosted compilation requires a service or daemon')) throw error;
    return compileDocumentToPcode(document);
  }
}

async function compileHostedDaemonCompanion(document: vscode.TextDocument): Promise<CompiledPcodeArtifact | null> {
  const sourceName = path.basename(document.fileName).toLowerCase();
  const daemonName = sourceName === 'discovery-collector-service.pas'
    ? 'discovery-maintenance-daemon.pas'
    : sourceName.endsWith('-service.pas')
      ? sourceName.replace(/-service\.pas$/, '-daemon.pas')
      : '';
  if (!daemonName) return null;
  const daemonPath = path.join(path.dirname(document.fileName), daemonName);
  let sourceText: string;
  try {
    sourceText = await fs.readFile(daemonPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  const root = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath
    || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) throw new Error('Open the project workspace before compiling a hosted daemon.');
  const compiler = await import(pathToFileURL(path.join(root, 'aggregator', 'scripts', 'compile-pascalish-program-antlr-to-pcode.mjs')).href);
  return compiler.compilePascalishProgramWithAntlr(sourceText, { fileName: daemonPath, hostServices: true });
}

function backendUrl(): string {
  return String(vscode.workspace.getConfiguration('pulse-pmachine').get('backendUrl', 'http://127.0.0.1:4000'))
    .trim()
    .replace(/\/$/, '');
}

export async function loadPmachineTargets(): Promise<PmachineRunTarget[]> {
  const targets: PmachineRunTarget[] = [{
    key: 'js',
    label: 'Local JavaScript PMachine',
    description: 'Local runtime',
    runtime: 'js',
  }];
  const response = await fetch(`${backendUrl()}/api/pmachine/nodes`, { signal: AbortSignal.timeout(5000) });
  const payload = await response.json().catch(() => ({})) as any;
  if (!response.ok) throw new Error(payload?.error || `PMachine target lookup failed (${response.status})`);
  const nodes = Array.isArray(payload) ? payload : Array.isArray(payload?.nodes) ? payload.nodes : [];
  for (const node of nodes) {
    const address = String(node?.ip || node?.address || '').trim();
    const runtime = String(node?.details?.runtime || node?.runtime || '').trim().toLowerCase();
    const hardware = String(node?.details?.hardware || node?.hardware || '').trim().toLowerCase();
    const serviceName = String(node?.serviceName || '').trim().toLowerCase();
    const nodeId = String(node?.nodeName || node?.nodeId || node?.id || address).trim();
    const isJavaScript = runtime === 'js' || runtime.includes('js-pmachine') || runtime.includes('javascript')
      || hardware.includes('javascript') || serviceName === 'js-pmachine'
      || nodeId.toLowerCase().includes('js-pmachine');
    const services = node?.details?.services || node?.services || [];
    const hasPmachine = Array.isArray(services) && services.some((service: any) => {
      const name = typeof service === 'string' ? service : service?.name || service?.serviceName;
      return String(name || '').trim().toLowerCase().includes('pmachine');
    });
    if (!address || !hasPmachine) continue;
    targets.push({
      key: `${isJavaScript ? 'js' : 'esp32'}:${nodeId}`,
      label: String(node?.nodeName || node?.name || nodeId),
      description: `${address} · ${isJavaScript ? 'JavaScript' : 'ESP32'} PMachine`,
      runtime: isJavaScript ? 'js' : 'esp32',
      nodeId,
      host: isJavaScript ? undefined : address,
    });
  }
  return targets;
}

async function runOnLocalJsPmachine(document: vscode.TextDocument, pcodeText: string, programMap: Record<string, any>): Promise<any> {
  const root = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath
    || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
  const runtime = await import(pathToFileURL(path.join(root, 'pmachines', 'javascript', 'src', 'runtime.mjs')).href);
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-vscode-run-'));
  try {
    const pcodePath = path.join(tempDirectory, 'program.pcode');
    const mapPath = path.join(tempDirectory, 'program.map.json');
    await fs.writeFile(pcodePath, pcodeText, 'utf8');
    await fs.writeFile(mapPath, JSON.stringify(programMap || {}), 'utf8');
    return await runtime.runSingleMessageForEvolution({
      pcode: pcodePath,
      programMap: mapPath,
      inputQueue: 'vscode.pmachine',
      message: '',
      messageFile: null,
      serviceId: '',
      organismId: '',
      generation: '0',
      fitnessOut: '',
    });
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
}

async function runCurrentFile(context: vscode.ExtensionContext, output: vscode.OutputChannel, uri?: vscode.Uri, hanoiPanel?: HanoiPanel): Promise<void> {
  const activeEditor = vscode.window.activeTextEditor;
  const document = uri
    ? await vscode.workspace.openTextDocument(uri)
    : activeEditor?.document;
  if (!document) {
    void vscode.window.showWarningMessage('Open a Pascalish program before running it.');
    return;
  }
  if (!pcodeLanguage(document)) {
    void vscode.window.showWarningMessage('Run on PMachine supports Pascalish, VBish, WFL, and MAPL programs.');
    return;
  }

  output.clear();
  output.appendLine(`Program: ${document.fileName}`);

  let targets: PmachineRunTarget[];
  try {
    targets = await loadPmachineTargets();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    output.appendLine(`Could not load PMachine targets: ${detail}`);
    targets = [{ key: 'js', label: 'Local JavaScript PMachine', description: 'Local runtime', runtime: 'js' }];
  }
  const discoveredHosts = new Set(targets.map((item) => String(item.description || '').split(' ')[0]));
  targets.push(...directNodeTargets().filter((item) => !discoveredHosts.has(String(item.host))));

  const lastTarget = context.globalState.get<string>('lastPmachineRunTarget');
  const target = await vscode.window.showQuickPick(
    targets.map((item) => ({ ...item, picked: item.key === lastTarget })),
    { placeHolder: 'Choose a PMachine to run this program on', matchOnDescription: true },
  );
  if (!target) return;
  await context.globalState.update('lastPmachineRunTarget', target.key);

  output.appendLine(`Target: ${target.label}${target.description ? ` (${target.description})` : ''}`);
  try {
    const artifact = await compileForTarget(document, target);
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Running ${path.basename(document.fileName)} on ${target.label}`,
      cancellable: false,
    }, async () => {
      const programMap = target.runtime === 'esp32' || target.host
        ? Object.fromEntries(Object.entries(artifact.programMap).filter(([key]) => key !== 'sourceMap'))
        : artifact.programMap;
      let result: any;
      if (target.host) {
        const root = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath
          || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        const runner = await import(pathToFileURL(path.join(root, 'aggregator', 'scripts', 'run-pascal-on-esp32-node.mjs')).href);
        const daemon = artifact.programMap.hostBindingsVersion === 1
          ? await compileHostedDaemonCompanion(document)
          : null;
        const payload = await runner.runPcodeOnEsp32({
          pcodeText: artifact.pcodeText,
          programMap,
          ...(daemon ? { daemonPcodeText: daemon.pcodeText, daemonProgramMap: daemon.programMap } : {}),
          node: target.host,
          inputQueue: 'vscode.pmachine',
          message: '',
          sourceFileName: path.basename(document.fileName),
        });
        result = payload?.result || payload;
        if (payload?.hosted) {
          output.appendLine(`Hosted service installed at http://${target.host}.`);
          if (Number.isInteger(payload.result?.udpPort)) output.appendLine(`Hosted UDP port: ${payload.result.udpPort}.`);
          const endpoints = Array.isArray(artifact.programMap.serviceEndpoints)
            ? artifact.programMap.serviceEndpoints.map((endpoint: any) => `${String(endpoint.verb || 'GET').toUpperCase()} ${endpoint.path}`)
            : [];
          for (const endpoint of endpoints) output.appendLine(`Service endpoint: http://${target.host}${endpoint.split(' ').slice(1).join(' ')}`);
        }
      } else if (target.key === 'js') {
        result = await runOnLocalJsPmachine(document, artifact.pcodeText, programMap);
      } else {
        const response = await fetch(`${backendUrl()}/api/pmachine/deploy-and-run`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            pcodeText: artifact.pcodeText,
            programMap,
            sourceFileName: path.basename(document.fileName),
            sourceLanguage: pcodeLanguage(document),
            runtime: target.runtime,
            ...(target.nodeId ? { targetNodeId: target.nodeId } : {}),
            inputQueue: 'vscode.pmachine',
            message: '',
          }),
          signal: AbortSignal.timeout(120000),
        });
        const payload = await response.json().catch(() => ({})) as any;
        if (!response.ok) throw new Error(payload?.error || `PMachine run failed (${response.status})`);
        result = payload?.result?.result || payload?.result || payload;
      }
      if (result?.error) throw new Error(String(result.error));
      const stdout = Array.isArray(result?.stdout) ? result.stdout : [];
      output.appendLine('');
      if (stdout.length === 0) output.appendLine('(no output)');
      else for (const line of stdout) output.appendLine(String(line));
      output.appendLine('');
      const globals = result?.globals && typeof result.globals === 'object' ? result.globals : {};
      if (Object.keys(globals).length > 0) output.appendLine(`Globals: ${JSON.stringify(globals)}`);
      output.appendLine(`Completed on ${target.label}${result?.stepCount ? ` (${result.stepCount} steps)` : ''}.`);
      output.show(true);
      if (hanoiPanel && vscode.workspace.getConfiguration('pulse-pmachine').get<boolean>('showAnimation', false)
        && looksLikeHanoi(document.getText(), document.fileName)) {
        hanoiPanel.show(`Run on ${target.label}`);
        hanoiPanel.post({ type: 'run', lines: stdout.map(String), globals });
      }
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    output.appendLine(`Run failed: ${detail}`);
    output.show(true);
    void vscode.window.showErrorMessage(`PMachine run failed: ${detail}`);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Pulse PMachine');
  const hanoiPanel = new HanoiPanel();
  const services = new ServicesViewProvider(output);
  context.subscriptions.push(
    output,
    hanoiPanel,
    services,
    vscode.window.registerTreeDataProvider('pulse-pmachine.services', services),
    vscode.commands.registerCommand('pulse-pmachine.refreshServices', () => services.refresh()),
    vscode.commands.registerCommand('pulse-pmachine.openServiceEndpoint', openServiceEndpoint),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('pulse-pmachine.backendUrl')) services.refresh();
    }),
    vscode.debug.registerDebugAdapterDescriptorFactory('pulse-pmachine', new PulseDebugFactory(context.extensionUri)),
    vscode.commands.registerCommand('pulse-pmachine.runCurrentFile', (uri?: vscode.Uri) => runCurrentFile(context, output, uri, hanoiPanel)),
    vscode.commands.registerCommand('pulse-pmachine.showAnimation', () => hanoiPanel.show('Towers of Hanoi')),
    vscode.debug.onDidReceiveDebugSessionCustomEvent((event) => {
      if (event.session.type !== 'pulse-pmachine') return;
      if (event.event === 'pulseLaunch') {
        hanoiPanel.trackSession(event.session.id, event.body?.isHanoi === true && event.body?.showAnimation === true);
        if (hanoiPanel.isTracking(event.session.id)) {
          hanoiPanel.show(`Debugging on ${event.body?.target || 'PMachine'}`);
          hanoiPanel.post({ type: 'reset', title: `Debugging on ${event.body?.target || 'PMachine'}` });
        }
        return;
      }
      if (!hanoiPanel.isTracking(event.session.id)) return;
      if (event.event === 'pulseOutput') hanoiPanel.post({ type: 'output', line: String(event.body?.line ?? '') });
      if (event.event === 'pulseState') hanoiPanel.post({ type: 'state', ...event.body });
    }),
    vscode.languages.registerCodeLensProvider([
      { language: 'pascalish' },
      { language: 'pascal' },
      { language: 'vbish' },
      { language: 'wfl' },
      { language: 'mapl' },
    ], {
      provideCodeLenses(document) {
        if (!pcodeLanguage(document)) return [];
        return [new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
          title: '$(play) Run on PMachine',
          command: 'pulse-pmachine.runCurrentFile',
          arguments: [document.uri],
        })];
      },
    }),
  );
}

export function deactivate(): void {}
