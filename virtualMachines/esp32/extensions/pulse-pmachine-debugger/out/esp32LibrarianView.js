import * as vscode from 'vscode';
import { ESP32_LIBRARIAN_SERVICE_ID, Esp32LibrarianBackend } from './esp32LibrarianBackend.js';
class Esp32LibrarianItem extends vscode.TreeItem {
    baseUrl;
    entry;
    constructor(label, baseUrl, entry) {
        const hasChildren = baseUrl && (!entry || entry.kind === 'directory');
        super(label, hasChildren
            ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        this.baseUrl = baseUrl;
        this.entry = entry;
        if (!baseUrl)
            return;
        this.id = JSON.stringify([baseUrl, entry?.path ?? null]);
        this.iconPath = new vscode.ThemeIcon(!entry ? 'circuit-board' : entry.kind === 'directory' ? 'folder' : 'file-code');
        this.description = !entry ? 'read-only catalog' : entry.kind === 'file' ? `${entry.size ?? '?'} bytes` : undefined;
        this.tooltip = `${ESP32_LIBRARIAN_SERVICE_ID} via Aggregator\n${entry?.path ?? 'Read-only schema catalog'}`
            + (entry?.kind === 'file' ? '\nOpen metadata. Native field parsing is not available in this profile.' : '');
        if (entry?.kind === 'file') {
            this.contextValue = 'pulseEsp32LibrarianSchema';
            this.command = { command: 'pulse-pmachine.openEsp32LibrarianSchema', title: 'Open ESP32 schema metadata', arguments: [this] };
        }
    }
}
export class Esp32LibrarianViewProvider {
    output;
    changes = new vscode.EventEmitter();
    onDidChangeTreeData = this.changes.event;
    abort = new AbortController();
    constructor(output) {
        this.output = output;
    }
    refresh() {
        this.abort.abort();
        this.abort = new AbortController();
        this.changes.fire(undefined);
    }
    dispose() { this.abort.abort(); this.changes.dispose(); }
    getTreeItem(item) { return item; }
    async getChildren(item) {
        if (!vscode.workspace.isTrusted)
            return [new Esp32LibrarianItem('Trust this workspace to contact the Aggregator')];
        const signal = this.abort.signal;
        try {
            if (!item) {
                const base = vscode.workspace.getConfiguration('pulse-pmachine')
                    .get('backendUrl', 'http://127.0.0.1:4000');
                const api = new Esp32LibrarianBackend(base, signal);
                return [new Esp32LibrarianItem(ESP32_LIBRARIAN_SERVICE_ID, api.baseUrl)];
            }
            if (!item.baseUrl)
                return [];
            if (item.entry?.kind === 'file')
                return [];
            const entries = await new Esp32LibrarianBackend(item.baseUrl, signal).schemas(item.entry?.path);
            if (signal.aborted)
                return [];
            return entries.length ? entries.sort((a, b) => a.name.localeCompare(b.name))
                .map(entry => new Esp32LibrarianItem(entry.name, item.baseUrl, entry))
                : [new Esp32LibrarianItem('No schemas visible to the ESP32')];
        }
        catch (error) {
            if (signal.aborted)
                return [];
            const detail = error instanceof Error ? error.message : String(error);
            this.output.appendLine(`ESP32 Data Librarian: ${detail}`);
            void vscode.window.showErrorMessage(`ESP32 Data Librarian: ${detail}`);
            const failed = new Esp32LibrarianItem('ESP32 schema details unavailable - refresh to retry');
            failed.tooltip = detail;
            return [failed];
        }
    }
}
export async function openEsp32LibrarianSchema(item) {
    if (!item?.entry || !item.baseUrl || !vscode.workspace.isTrusted)
        return;
    try {
        const document = await vscode.workspace.openTextDocument({
            language: 'json', content: `${JSON.stringify({
                serviceId: ESP32_LIBRARIAN_SERVICE_ID, profile: 'read-only', ...item.entry,
                structureAvailable: false,
                note: 'Metadata is routed to the logical read-only Librarian service through the configured Aggregator. This profile does not expose schema contents or field structures.',
            }, null, 2)}\n`,
        });
        await vscode.window.showTextDocument(document, { preview: true });
    }
    catch (error) {
        void vscode.window.showErrorMessage(`ESP32 Data Librarian: ${error instanceof Error ? error.message : String(error)}`);
    }
}
//# sourceMappingURL=esp32LibrarianView.js.map