import * as vscode from 'vscode';
import { loadSwarmNodes } from './swarmBackend.js';
export class SwarmViewProvider {
    output;
    changes = new vscode.EventEmitter();
    onDidChangeTreeData = this.changes.event;
    rootItems;
    rootLoading = false;
    constructor(output) {
        this.output = output;
    }
    refresh() { this.rootItems = undefined; this.rootLoading = false; this.changes.fire(undefined); }
    dispose() { this.changes.dispose(); }
    getTreeItem(item) { return item; }
    async getChildren(item) {
        if (item)
            return [];
        if (this.rootItems)
            return this.rootItems;
        if (this.rootLoading)
            return [new vscode.TreeItem('Loading Swarm...')];
        this.rootLoading = true;
        void this.loadRoot().then(items => {
            this.rootItems = items;
            this.rootLoading = false;
            this.changes.fire(undefined);
        }, error => {
            this.rootItems = [new vscode.TreeItem(`Swarm unavailable - ${error instanceof Error ? error.message : String(error)}`)];
            this.rootLoading = false;
            this.changes.fire(undefined);
        });
        return [new vscode.TreeItem('Loading Swarm...')];
    }
    async loadRoot() {
        const base = vscode.workspace.getConfiguration('pulse-pmachine')
            .get('backendUrl', 'http://127.0.0.1:4000').trim();
        try {
            const nodes = await loadSwarmNodes(base);
            return [
                this.nodeItem({
                    id: 'local-js',
                    name: 'Local JavaScript PMachine',
                    address: 'Local',
                    runtime: 'JavaScript',
                    key: 'js',
                    local: true,
                }),
                ...nodes.map(node => this.nodeItem(node)),
            ];
        }
        catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            this.output.appendLine(`Swarm discovery failed: ${detail}`);
            const unavailable = new vscode.TreeItem('Swarm unavailable - refresh to retry');
            unavailable.tooltip = detail;
            unavailable.iconPath = new vscode.ThemeIcon('warning');
            return [this.nodeItem({
                id: 'local-js',
                name: 'Local JavaScript PMachine',
                address: 'Local',
                runtime: 'JavaScript',
                key: 'js',
                local: true,
            }), unavailable];
        }
    }
    nodeItem(node) {
        const item = new vscode.TreeItem(node.name, vscode.TreeItemCollapsibleState.None);
        item.id = `swarm:${node.id}`;
        item.description = `${node.address} / ${node.runtime}`;
        item.tooltip = `${node.name}\n${node.id}\n${node.address}\n${node.runtime}\nAvailable for p-code execution`;
        item.iconPath = new vscode.ThemeIcon('server', new vscode.ThemeColor('testing.iconPassed'));
        item.contextValue = 'pulseSwarmNode';
        item.node = node;
        return item;
    }
}
//# sourceMappingURL=swarmView.js.map