import * as vscode from 'vscode';

type ServiceOffering = {
  id: string;
  name: string;
  description: string;
  provider: string;
  protocol: string;
  endpoint: string;
  configurationRef: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function optionalText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseOfferings(payload: unknown): ServiceOffering[] {
  if (!isRecord(payload) || !Array.isArray(payload.services)) {
    throw new Error('Services response does not contain services.');
  }
  const ids = new Set<string>();
  return payload.services.map((value: unknown) => {
    if (!isRecord(value)) throw new Error('Invalid service in services response.');
    const id = optionalText(value.id) || optionalText(value.serviceId);
    const name = optionalText(value.name) || optionalText(value.serviceId);
    if (!id || !name || ids.has(id)) throw new Error('Service offerings require unique IDs and names.');
    ids.add(id);
    return {
      id, name,
      description: [optionalText(value.description), optionalText(value.nodeId), optionalText(value.status)].filter(Boolean).join('\n'),
      provider: optionalText(value.provider),
      protocol: optionalText(value.protocol),
      endpoint: optionalText(value.endpoint),
      configurationRef: optionalText(value.configurationRef),
    };
  }).sort((left, right) => left.name.localeCompare(right.name));
}

export class ServiceCatalogItem extends vscode.TreeItem {
  constructor(readonly offering: ServiceOffering | null, label: string, detail = '') {
    super(label, offering ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
    this.description = detail;
    if (offering) {
      this.id = offering.id;
      this.description = [offering.provider, offering.protocol].filter(Boolean).join(' / ');
      this.tooltip = [offering.name, offering.description, offering.endpoint || 'No endpoint configured.'].join('\n');
      this.contextValue = offering.endpoint ? 'pulseServiceEndpoint' : 'pulseServiceOffering';
      this.iconPath = new vscode.ThemeIcon('server');
    }
  }
}

export class ServicesViewProvider implements vscode.TreeDataProvider<ServiceCatalogItem>, vscode.Disposable {
  private readonly changes = new vscode.EventEmitter<ServiceCatalogItem | undefined>();
  readonly onDidChangeTreeData = this.changes.event;

  constructor(private readonly output: vscode.OutputChannel) {}

  refresh(): void {
    this.changes.fire(undefined);
  }

  dispose(): void {
    this.changes.dispose();
  }

  getTreeItem(item: ServiceCatalogItem): vscode.TreeItem {
    return item;
  }

  async getChildren(item?: ServiceCatalogItem): Promise<ServiceCatalogItem[]> {
    if (item) {
      const offering = item.offering;
      if (!offering) return [];
      const endpoint = new ServiceCatalogItem(null, 'Endpoint', offering.endpoint || 'Not configured');
      if (offering.endpoint) {
        endpoint.command = {
          command: 'pulse-pmachine.openServiceEndpoint',
          title: 'Open Service Endpoint',
          arguments: [item],
        };
      }
      return [
        endpoint,
        new ServiceCatalogItem(null, 'Provider', offering.provider || 'Not specified'),
        new ServiceCatalogItem(null, 'Protocol', offering.protocol || 'Not specified'),
        ...(offering.configurationRef
          ? [new ServiceCatalogItem(null, 'Configuration', offering.configurationRef)]
          : []),
      ];
    }

    const base = String(vscode.workspace.getConfiguration('pulse-pmachine')
      .get('backendUrl', 'http://127.0.0.1:4000')).trim().replace(/\/$/, '');
    try {
      const response = await fetch(`${base}/api/services`, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`Services request failed (HTTP ${response.status}).`);
      const payload: unknown = await response.json();
      const offerings = parseOfferings(payload);
      const items = offerings.length
        ? offerings.map(offering => new ServiceCatalogItem(offering, offering.name))
        : [new ServiceCatalogItem(null, 'No services registered')];
      if (isRecord(payload) && Array.isArray(payload.errors)) {
        for (const error of payload.errors) {
          if (!isRecord(error)) continue;
          const detail = `${optionalText(error.endpoint)}: ${optionalText(error.error)}`;
          this.output.appendLine(`Services discovery failed: ${detail}`);
          items.push(new ServiceCatalogItem(null, 'Service registry unavailable', detail));
        }
      }
      return items;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.output.appendLine(`Services catalog failed: ${detail}`);
      void vscode.window.showErrorMessage(`Pulse Services: ${detail}`);
      return [new ServiceCatalogItem(null, 'Services unavailable - refresh to retry', detail)];
    }
  }
}

export async function openServiceEndpoint(item?: ServiceCatalogItem): Promise<void> {
  const endpoint = item?.offering?.endpoint;
  if (!endpoint) {
    void vscode.window.showWarningMessage('This service has no configured endpoint.');
    return;
  }
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    void vscode.window.showErrorMessage('The service endpoint is not a valid URL.');
    return;
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    void vscode.window.showWarningMessage('Only HTTP and HTTPS service endpoints can be opened in a browser.');
    return;
  }
  if (!await vscode.env.openExternal(vscode.Uri.parse(url.href))) {
    void vscode.window.showErrorMessage(`Unable to open service endpoint: ${url.href}`);
  }
}
