import * as vscode from 'vscode';
import { loadSwarmNodes, type SwarmNode } from './swarmBackend.js';

export class SwarmViewProvider implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable {
  private readonly changes = new vscode.EventEmitter<vscode.TreeItem | undefined>();
  readonly onDidChangeTreeData = this.changes.event;

  constructor(private readonly output: vscode.OutputChannel) {}

  refresh(): void { this.changes.fire(undefined); }
  dispose(): void { this.changes.dispose(); }
  getTreeItem(item: vscode.TreeItem): vscode.TreeItem { return item; }

  async getChildren(item?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (item) return [];
    const base = vscode.workspace.getConfiguration('pulse-pmachine')
      .get<string>('backendUrl', 'http://127.0.0.1:4000').trim();
    try {
      const nodes = await loadSwarmNodes(base);
      return nodes.length ? nodes.map(node => this.nodeItem(node))
        : [new vscode.TreeItem('No available p-code nodes')];
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.output.appendLine(`Swarm discovery failed: ${detail}`);
      const unavailable = new vscode.TreeItem('Swarm unavailable - refresh to retry');
      unavailable.tooltip = detail;
      unavailable.iconPath = new vscode.ThemeIcon('warning');
      return [unavailable];
    }
  }

  private nodeItem(node: SwarmNode): vscode.TreeItem {
    const item = new vscode.TreeItem(node.name, vscode.TreeItemCollapsibleState.None);
    item.id = `swarm:${node.id}`;
    item.description = `${node.address} / ${node.runtime}`;
    item.tooltip = `${node.name}\n${node.id}\n${node.address}\n${node.runtime}\nAvailable for p-code execution`;
    item.iconPath = new vscode.ThemeIcon('server', new vscode.ThemeColor('testing.iconPassed'));
    item.contextValue = 'pulseSwarmNode';
    return item;
  }
}
