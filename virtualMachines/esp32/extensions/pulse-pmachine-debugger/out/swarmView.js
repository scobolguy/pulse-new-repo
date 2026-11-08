import * as vscode from 'vscode';
import { loadSwarmNodes } from './swarmBackend.js';
export class SwarmViewProvider {
    output;
    changes = new vscode.EventEmitter();
    onDidChangeTreeData = this.changes.event;
    constructor(output) {
        this.output = output;
    }
    refresh() { this.changes.fire(undefined); }
    dispose() { this.changes.dispose(); }
    getTreeItem(item) { return item; }
    async getChildren(item) {
        if (item)
            return [];
        const base = vscode.workspace.getConfiguration('pulse-pmachine')
            .get('backendUrl', 'http://127.0.0.1:4000').trim();
        try {
            const nodes = await loadSwarmNodes(base);
            return nodes.length ? nodes.map(node => this.nodeItem(node))
                : [new vscode.TreeItem('No available p-code nodes')];
        }
        catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            this.output.appendLine(`Swarm discovery failed: ${detail}`);
            const unavailable = new vscode.TreeItem('Swarm unavailable - refresh to retry');
            unavailable.tooltip = detail;
            unavailable.iconPath = new vscode.ThemeIcon('warning');
            return [unavailable];
        }
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