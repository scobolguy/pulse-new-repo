import * as vscode from 'vscode';
import { loadSwarmNodes, type SwarmNode } from './swarmBackend.js';

export class SwarmViewProvider implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable {
  private readonly changes = new vscode.EventEmitter<vscode.TreeItem | undefined>();
  readonly onDidChangeTreeData = this.changes.event;
  private rootItems: vscode.TreeItem[] | undefined;
  private loading: Promise<void> | undefined;
  private lastError: string | undefined;

  constructor(private readonly output: vscode.OutputChannel) {}

  refresh(): Promise<void> {
    return this.loading ??= this.updateRoot().finally(() => { this.loading = undefined; });
  }
  dispose(): void { this.changes.dispose(); }
  getTreeItem(item: vscode.TreeItem): vscode.TreeItem { return item; }

  async getChildren(item?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (item) return [];
    if (!this.rootItems) await this.refresh();
    return this.rootItems ?? [];
  }

  private async updateRoot(): Promise<void> {
    const base = vscode.workspace.getConfiguration('pulse-pmachine')
      .get<string>('backendUrl', 'http://127.0.0.1:4000').trim();
    try {
      const nodes = await loadSwarmNodes(base);
      this.lastError = undefined;
      const previous = this.rootItems ?? [];
      const changed: vscode.TreeItem[] = [];
      const next = nodes.length ? nodes.map(node => {
        const fresh = this.nodeItem(node);
        const existing = previous.find(item => item.id === fresh.id);
        if (!existing) return fresh;
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
      } else {
        for (const item of changed) this.changes.fire(item);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (this.lastError === detail) return;
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

  private emptyItem(): vscode.TreeItem {
    const item = new vscode.TreeItem('No available p-code nodes');
    item.id = 'swarm:empty-status';
    return item;
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
