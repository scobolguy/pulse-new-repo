import * as vscode from 'vscode';
import { loadSwarmNodes } from './swarmBackend.js';
export class SwarmViewProvider {
    output;
    changes = new vscode.EventEmitter();
    onDidChangeTreeData = this.changes.event;
    rootItems;
    loading;
    lastError;
    constructor(output) {
        this.output = output;
    }
    refresh() {
        return this.loading ??= this.updateRoot().finally(() => { this.loading = undefined; });
    }
    dispose() { this.changes.dispose(); }
    getTreeItem(item) { return item; }
    async getChildren(item) {
        if (item)
            return [];
        if (!this.rootItems)
            await this.refresh();
        return this.rootItems ?? [];
    }
    async updateRoot() {
        const base = vscode.workspace.getConfiguration('pulse-pmachine')
            .get('backendUrl', 'http://127.0.0.1:4000').trim();
        try {
            const nodes = await loadSwarmNodes(base);
            this.lastError = undefined;
            const previous = this.rootItems ?? [];
            const changed = [];
            const next = nodes.length ? nodes.map(node => {
                const fresh = this.nodeItem(node);
                const existing = previous.find(item => item.id === fresh.id);
                if (!existing)
                    return fresh;
                if (existing.label !== fresh.label || existing.description !== fresh.description
                    || existing.tooltip !== fresh.tooltip) {
                    Object.assign(existing, fresh);
                    changed.push(existing);
                }
                return existing;
            }) : [previous.find(item => item.id === 'swarm:empty-status') ?? this.emptyItem()];
            this.rootItems = next;
            if (next.length !== previous.length || next.some((item, index) => item !== previous[index])) {
                this.changes.fire(undefined);
            }
            else {
                for (const item of changed)
                    this.changes.fire(item);
            }
        }
        catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            if (this.lastError === detail)
                return;
            this.lastError = detail;
            this.output.appendLine(`Swarm discovery failed: ${detail}`);
            if (!this.rootItems || this.rootItems[0]?.contextValue === 'pulseSwarmUnavailable') {
                const unavailable = new vscode.TreeItem('Swarm unavailable - refresh to retry');
                unavailable.contextValue = 'pulseSwarmUnavailable';
                unavailable.tooltip = detail;
                unavailable.iconPath = new vscode.ThemeIcon('warning');
                this.rootItems = [unavailable];
                this.changes.fire(undefined);
            }
        }
    }
    emptyItem() {
        const item = new vscode.TreeItem('No available p-code nodes');
        item.id = 'swarm:empty-status';
        return item;
    }
    nodeItem(node) {
        const item = new vscode.TreeItem(node.name, vscode.TreeItemCollapsibleState.None);
        item.id = `swarm:${node.id}`;
        item.description = `${node.address} / ${node.runtime}`;
        item.tooltip = `${node.name}\n${node.id}\n${node.address}\n${node.runtime}\nAvailable for p-code execution`;
        item.iconPath = new vscode.ThemeIcon('server', new vscode.ThemeColor('testing.iconPassed'));
        item.contextValue = 'pulseSwarmNode';
        return item;
    }
}
//# sourceMappingURL=swarmView.js.map