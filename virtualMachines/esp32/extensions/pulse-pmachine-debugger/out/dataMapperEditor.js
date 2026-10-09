import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import { applyMappingAction, emptyMapping, fieldsOf, object, parseMapping, prototypeMapping, publicationPayload, rulesOf } from './dataMapperModel.js';
import { DataMapperBackend } from './dataMapperBackend.js';
const viewType = 'pulse-pmachine.dataMapper';
export class DataMapperEditor {
    extensionUri;
    output;
    constructor(extensionUri, output) {
        this.extensionUri = extensionUri;
        this.output = output;
    }
    resolveCustomTextEditor(document, panel) {
        const media = vscode.Uri.joinPath(this.extensionUri, 'src', 'media');
        panel.webview.options = { enableScripts: true, localResourceRoots: [media] };
        const nonce = randomBytes(16).toString('hex');
        const script = panel.webview.asWebviewUri(vscode.Uri.joinPath(media, 'dataMapper.js'));
        const style = panel.webview.asWebviewUri(vscode.Uri.joinPath(media, 'dataMapper.css'));
        panel.webview.html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource}; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${style}"><title>Pulse Data Mapper</title></head>
<body><header><div><span class="badge">DESIGNER</span><h1>Pulse Data Mapper</h1>
<p id="name"></p></div><button id="text">Open JSON</button></header>
<nav class="toolbar" aria-label="Mapping actions"><button id="metadata">Map details</button>
<button id="source-pick">Choose source schema</button><button id="target-pick">Choose target schema</button>
<button id="refresh-schemas">Refresh selected schemas</button><button id="import">Import backend map</button>
<button id="publish">Publish to Aggregator</button></nav>
<p id="backend" class="hint"></p>
<p class="hint">Drag a source field onto a target field, or select a source then click a target.
Use Ctrl+S to save and VS Code Undo/Redo to edit history.</p>
<p id="status" role="status" aria-live="polite"></p>
<main id="designer"><section class="fields"><h2>Source</h2><p id="source-schema"></p>
<label class="sr-only" for="source-search">Filter source fields</label><input id="source-search" type="search" placeholder="Filter source fields"><div id="source"></div></section>
<section id="connections" aria-label="Mapping connections"><svg id="wires" aria-hidden="true"></svg><div id="links"></div></section>
<section class="fields"><h2>Target</h2><p id="target-schema"></p>
<label class="sr-only" for="target-search">Filter target fields</label><input id="target-search" type="search" placeholder="Filter target fields"><div id="target"></div></section></main>
<section class="properties"><h2>Mapping properties</h2><p id="selection">Select a connection to edit its conversion rule.</p>
<label for="conversion">Pascalish conversion rule (basic checks locally; execution validated by Aggregator)</label>
<textarea id="conversion" rows="3" maxlength="1000" disabled placeholder="Example: output := trim(src);"></textarea>
<div class="actions"><button id="apply" disabled>Apply rule</button><button id="remove" disabled>Remove connection</button></div>
</section>
<section class="properties"><h2>Test mapping</h2>
<p class="hint">Runs the published map through the Aggregator. Publish local changes first. Nothing is deployed to a PMachine.</p>
<label for="payload">Sample input JSON object (takes precedence over test case)</label>
<textarea id="payload" rows="7" placeholder='{"reference":"PAY-001","amount":125.50,"currency":"USD"}'></textarea>
<div class="actions"><button id="test-cases">Load test cases</button>
<label class="sr-only" for="test-case">Test case</label><select id="test-case"><option value="">Select test case</option></select>
<button id="run">Run published map</button></div><p id="result-status" role="status"></p>
<div class="results"><div><h3>Mapped output</h3><pre id="result-output">No run yet.</pre></div>
<div><h3>Diagnostics</h3><pre id="result-diagnostics">No run yet.</pre></div></div>
</section><script nonce="${nonce}" src="${script}"></script></body></html>`;
        let editing = false;
        let operating = false;
        let disposed = false;
        let backendRevision = 0;
        const abort = new AbortController();
        const backend = () => {
            if (!vscode.workspace.isTrusted)
                throw new Error('Trust this workspace before using the Aggregator.');
            return new DataMapperBackend(vscode.workspace.getConfiguration('pulse-pmachine').get('backendUrl', 'http://127.0.0.1:4000'), abort.signal);
        };
        const report = (error, actionError = false) => {
            const detail = error instanceof Error ? error.message : String(error);
            this.output.appendLine(`Data Mapper: ${detail}`);
            void panel.webview.postMessage({ type: 'error', message: detail, actionError });
        };
        const update = () => {
            try {
                const map = parseMapping(document.getText());
                void panel.webview.postMessage({ type: 'state', version: document.version, name: map.name,
                    id: map.id,
                    sourceSchema: map.sourceSchemaPath, targetSchema: map.targetSchemaPath,
                    source: fieldsOf(map, 'source'), target: fieldsOf(map, 'target'), rules: rulesOf(map) });
            }
            catch (error) {
                report(error);
            }
        };
        const changed = vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.uri.toString() === document.uri.toString())
                update();
        });
        const replace = async (map, version) => {
            if (disposed || editing || document.version !== version)
                throw new Error('The document changed. Retry against the refreshed map.');
            editing = true;
            try {
                const edit = new vscode.WorkspaceEdit();
                edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), `${JSON.stringify(map, null, 2)}\n`);
                if (!await vscode.workspace.applyEdit(edit))
                    throw new Error('VS Code could not apply the mapping edit.');
            }
            finally {
                editing = false;
            }
            update();
        };
        const confirmClear = async () => {
            return await vscode.window.showWarningMessage('Changing schema removes all existing field connections. This can be undone locally.', { modal: true }, 'Change schema and clear connections') === 'Change schema and clear connections';
        };
        const runOperation = async (message) => {
            if (operating || editing)
                throw new Error('Another designer action is in progress.');
            if (message.version !== document.version)
                throw new Error('The document changed. Retry against the refreshed map.');
            const version = document.version;
            const revision = backendRevision;
            const checkBackend = () => {
                if (disposed || revision !== backendRevision)
                    throw new Error('Backend configuration changed. Retry against the current Aggregator.');
            };
            const map = parseMapping(document.getText());
            operating = true;
            void panel.webview.postMessage({ type: 'busy', busy: true, message: 'Working…' });
            try {
                if (message.type === 'metadata') {
                    const id = await vscode.window.showInputBox({ title: 'Mapping ID', value: typeof map.id === 'string' ? map.id : '',
                        validateInput: value => /^[A-Za-z0-9_-]+$/.test(value) ? undefined : 'Use letters, numbers, underscores and hyphens.' });
                    if (id === undefined)
                        return;
                    const name = await vscode.window.showInputBox({ title: 'Mapping name', value: typeof map.name === 'string' ? map.name : '',
                        validateInput: value => value.trim() ? undefined : 'Enter a name.' });
                    if (name === undefined)
                        return;
                    await replace({ ...map, id, name: name.trim() }, version);
                }
                else if (message.type === 'schema' || message.type === 'refreshSchemas') {
                    const schemas = await backend().schemas();
                    let next = map;
                    if (message.type === 'schema') {
                        if (message.side !== 'source' && message.side !== 'target')
                            throw new Error('Invalid schema side.');
                        const choices = schemas.filter(schema => schema.structure);
                        if (!choices.length)
                            throw new Error('Librarian has no schemas with field structures.');
                        const choice = await vscode.window.showQuickPick(choices.map(schema => ({
                            label: typeof schema.name === 'string' ? schema.name : schema.path,
                            description: typeof schema.typeId === 'string' ? schema.typeId : '',
                            detail: schema.path, schema,
                        })), { title: `Choose ${message.side} schema (${schemas.length - choices.length} schemas without field structures omitted)`,
                            matchOnDescription: true, matchOnDetail: true });
                        if (!choice)
                            return;
                        const side = message.side;
                        const clear = map[`${side}SchemaPath`] !== choice.schema.path && rulesOf(map).length > 0;
                        if (clear && !await confirmClear())
                            return;
                        next = { ...map, [`${side}SchemaPath`]: choice.schema.path,
                            [`${side}TypeId`]: String(choice.schema.typeId || choice.schema.path).toLowerCase(),
                            [`${side}Structure`]: choice.schema.structure, [`${side}SchemaMtime`]: choice.schema.mtime ?? '',
                            ...(clear ? { [map.rules ? 'rules' : 'items']: [] } : {}) };
                    }
                    else {
                        for (const side of ['source', 'target']) {
                            const schema = schemas.find(entry => entry.path === map[`${side}SchemaPath`]);
                            if (!schema?.structure)
                                throw new Error(`Selected ${side} schema is unavailable in Librarian.`);
                            next = { ...next, [`${side}Structure`]: schema.structure, [`${side}SchemaMtime`]: schema.mtime ?? '' };
                        }
                    }
                    fieldsOf(next, 'source');
                    fieldsOf(next, 'target');
                    checkBackend();
                    await replace(next, version);
                }
                else if (message.type === 'publish') {
                    publicationPayload(map);
                    const api = backend();
                    const existing = await api.existingMap(String(map.id));
                    const answer = await vscode.window.showWarningMessage(existing ? `Replace backend map "${map.id}" at ${api.baseUrl}?`
                        : `Publish new map "${map.id}" to ${api.baseUrl}?`, { modal: true }, existing ? 'Replace backend map' : 'Publish map');
                    if (answer !== (existing ? 'Replace backend map' : 'Publish map'))
                        return;
                    checkBackend();
                    if (disposed || document.version !== version)
                        throw new Error('Document changed before publishing. Retry.');
                    const saved = await api.publish(map, existing);
                    if (revision !== backendRevision)
                        throw new Error(`The captured map was published to ${api.baseUrl}, but backend configuration changed. Import or publish to the current backend before running.`);
                    // Keep local-only metadata and the legacy items representation.
                    const { rules, ...metadata } = saved;
                    if (document.version !== version)
                        throw new Error('The captured map was published, but the local document changed. Publish again before running.');
                    await replace({ ...map, ...metadata, [map.rules ? 'rules' : 'items']: rulesOf(saved) }, version);
                    void panel.webview.postMessage({ type: 'notice', message: `Published "${saved.id}" to ${api.baseUrl}. Save the local file with Ctrl+S.` });
                }
                else if (message.type === 'testCases') {
                    const testCases = await backend().testCases();
                    checkBackend();
                    void panel.webview.postMessage({ type: 'testCases', testCases });
                }
                else if (message.type === 'run') {
                    const result = await backend().run(map, message.input);
                    checkBackend();
                    if (document.version !== version)
                        throw new Error('Run completed for an older document version. Publish and run the current map again.');
                    void panel.webview.postMessage({ type: 'result', version, result });
                }
                else
                    throw new Error('Unknown backend action.');
            }
            finally {
                operating = false;
                if (!disposed)
                    void panel.webview.postMessage({ type: 'busy', busy: false });
            }
        };
        const received = panel.webview.onDidReceiveMessage(async (message) => {
            try {
                if (!object(message) || !('type' in message))
                    throw new Error('Invalid designer message.');
                if (message.type === 'ready') {
                    update();
                    void panel.webview.postMessage({ type: 'backend', url: vscode.workspace.getConfiguration('pulse-pmachine').get('backendUrl', 'http://127.0.0.1:4000') });
                    return;
                }
                if (message.type === 'text') {
                    await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default', vscode.ViewColumn.Beside);
                    return;
                }
                if (message.type === 'import') {
                    if (operating || editing)
                        throw new Error('Another designer action is in progress.');
                    operating = true;
                    try {
                        await vscode.commands.executeCommand('pulse-pmachine.importDataMap');
                    }
                    finally {
                        operating = false;
                        void panel.webview.postMessage({ type: 'busy', busy: false });
                    }
                    return;
                }
                if (message.type !== 'edit') {
                    await runOperation(message);
                    return;
                }
                if (!('version' in message) || !('action' in message))
                    throw new Error('Invalid edit request.');
                if (operating || editing || message.version !== document.version) {
                    update();
                    throw new Error('The document changed. Please retry your edit against the refreshed map.');
                }
                const map = applyMappingAction(parseMapping(document.getText()), message.action);
                await replace(map, document.version);
            }
            catch (error) {
                report(error, true);
            }
        });
        const configured = vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('pulse-pmachine.backendUrl')) {
                backendRevision++;
                void panel.webview.postMessage({ type: 'backend', url: vscode.workspace.getConfiguration('pulse-pmachine').get('backendUrl', 'http://127.0.0.1:4000') });
            }
        });
        panel.onDidDispose(() => { disposed = true; abort.abort(); changed.dispose(); received.dispose(); configured.dispose(); });
    }
}
export function registerDataMapper(context, output) {
    const open = async (uri) => {
        const selected = uri ?? vscode.window.activeTextEditor?.document.uri
            ?? (await vscode.window.showOpenDialog({ canSelectMany: false, filters: { 'Mapping JSON': ['json'] } }))?.[0];
        if (selected)
            await vscode.commands.executeCommand('vscode.openWith', selected, viewType);
    };
    const command = (run) => async (uri) => {
        try {
            await run(uri);
        }
        catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            output.appendLine(`Data Mapper: ${detail}`);
            void vscode.window.showErrorMessage(`Data Mapper: ${detail}`);
        }
    };
    const createFile = async (map, fileName) => {
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.workspace.workspaceFolders?.[0]
                ? vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, fileName) : undefined,
            filters: { 'Mapping JSON': ['json'] },
        });
        if (!uri)
            return;
        const edit = new vscode.WorkspaceEdit();
        edit.createFile(uri, { overwrite: false });
        edit.insert(uri, new vscode.Position(0, 0), `${JSON.stringify(map, null, 2)}\n`);
        if (!await vscode.workspace.applyEdit(edit))
            throw new Error('Could not create the mapping file. Choose a new file name.');
        const document = await vscode.workspace.openTextDocument(uri);
        if (!await document.save())
            throw new Error('Could not save the mapping file.');
        await open(uri);
    };
    context.subscriptions.push(vscode.window.registerCustomEditorProvider(viewType, new DataMapperEditor(context.extensionUri, output), {
        supportsMultipleEditorsPerDocument: false,
    }), vscode.commands.registerCommand('pulse-pmachine.openDataMap', command(open)), vscode.commands.registerCommand('pulse-pmachine.newDataMap', command(async () => {
        await createFile(prototypeMapping(), 'prototype.pulse-map.json');
    })), vscode.commands.registerCommand('pulse-pmachine.createDataMap', command(async () => {
        await createFile(emptyMapping(), 'new.pulse-map.json');
    })), vscode.commands.registerCommand('pulse-pmachine.importDataMap', command(async () => {
        if (!vscode.workspace.isTrusted)
            throw new Error('Trust this workspace before using the Aggregator.');
        const api = new DataMapperBackend(vscode.workspace.getConfiguration('pulse-pmachine').get('backendUrl', 'http://127.0.0.1:4000'));
        const maps = await api.maps();
        if (!maps.length)
            throw new Error('Aggregator has no saved maps to import.');
        const choice = await vscode.window.showQuickPick(maps.map(map => ({ label: map.name, description: map.id, id: map.id })), { title: `Import mapping from ${api.baseUrl}`, matchOnDescription: true });
        if (!choice)
            return;
        const map = await api.map(choice.id);
        fieldsOf(map, 'source');
        fieldsOf(map, 'target');
        await createFile(map, `${choice.id.replace(/[^A-Za-z0-9_-]/g, '_')}.pulse-map.json`);
    })));
}
//# sourceMappingURL=dataMapperEditor.js.map