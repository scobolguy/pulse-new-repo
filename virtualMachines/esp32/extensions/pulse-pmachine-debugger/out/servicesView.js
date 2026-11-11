import * as vscode from 'vscode';
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function optionalText(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function isServer(value) {
    return value.category === 'server'
        || ['database', 'messaging', 'development-host', 'server'].includes(value.kind)
        || ['rabbitmq', 'mssql', 'msmq', 'access', 'postgres', 'mysql', 'mongodb', 'kafka', 'ibmmq'].includes(value.provider.toLowerCase());
}
function parseOfferings(payload, category) {
    if (!isRecord(payload) || !Array.isArray(payload.services)) {
        throw new Error('Services response does not contain services.');
    }
    const values = category === 'servers' && Array.isArray(payload.servers) ? payload.servers : payload.services;
    const ids = new Set();
    return values.map((value) => {
        if (!isRecord(value))
            throw new Error('Invalid service in services response.');
        const registryId = optionalText(value.id) || optionalText(value.serviceId);
        const instanceId = optionalText(value.instanceId);
        const nodeId = optionalText(value.nodeId) || optionalText(value.serverRef) || optionalText(value.address);
        const endpoint = optionalText(value.endpoint);
        const identity = [instanceId, nodeId, endpoint].filter(Boolean).join(':');
        const id = identity ? `${registryId}:${identity}` : registryId;
        const name = optionalText(value.name) || optionalText(value.serviceId);
        if (!registryId || !name || ids.has(id))
            throw new Error('Service offerings require names and unique instance identities.');
        ids.add(id);
        return {
            id, name,
            description: [optionalText(value.description), optionalText(value.nodeId), optionalText(value.status)].filter(Boolean).join('\n'),
            provider: optionalText(value.provider),
            protocol: optionalText(value.protocol),
            endpoint,
            configurationRef: optionalText(value.configurationRef),
            serviceId: optionalText(value.serviceId) || name,
            instanceId,
            nodeId,
            status: optionalText(value.status),
            kind: optionalText(value.kind),
            category: optionalText(value.category),
        };
    }).filter(offering => category === 'servers'
        ? Array.isArray(payload.servers) || isServer(offering)
        : !isServer(offering))
        .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}
export class ServiceCatalogItem extends vscode.TreeItem {
    offering;
    instances;
    constructor(offering, label, detail = '', instances = []) {
        super(label, instances.length ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        this.offering = offering;
        this.instances = instances;
        this.description = detail;
        if (offering) {
            this.id = offering.id;
            this.description = [offering.nodeId, offering.status, offering.provider, offering.protocol].filter(Boolean).join(' / ');
            this.tooltip = [offering.name, offering.description, offering.endpoint || 'No endpoint configured.', offering.configurationRef].filter(Boolean).join('\n');
            this.contextValue = offering.endpoint ? 'pulseServiceEndpoint' : 'pulseServiceOffering';
            this.iconPath = new vscode.ThemeIcon('server');
            if (offering.endpoint) {
                this.command = { command: 'pulse-pmachine.openServiceEndpoint', title: 'Open Endpoint', arguments: [this] };
            }
        }
    }
}
export class ServicesViewProvider {
    output;
    category;
    changes = new vscode.EventEmitter();
    onDidChangeTreeData = this.changes.event;
    rootItems;
    rootLoading = false;
    constructor(output, category = 'services') {
        this.output = output;
        this.category = category;
    }
    refresh() {
        this.rootItems = undefined;
        this.rootLoading = false;
        this.changes.fire(undefined);
    }
    dispose() {
        this.changes.dispose();
    }
    async dataLibrarianItem(base) {
        const collections = [
            ['Files', '/api/librarian/files', 'files'],
            ['Schemas', '/api/librarian/schemas', 'schemas'],
            ['Subschemas', '/api/librarian/subschemas', 'subschemas'],
            ['Data Types', '/api/librarian/data-types', 'dataTypes'],
            ['Mapper Rulesets', '/api/librarian/mapper-rulesets', 'mapperRulesets'],
        ];
        const groups = await Promise.all(collections.map(async ([label, path, key]) => {
            const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(15000) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok)
                throw new Error(`${path} returned HTTP ${response.status}`);
            const values = payload?.[key];
            if (!Array.isArray(values))
                throw new Error(`${path} returned an invalid collection`);
            const entries = values.map((value, index) => {
                const id = String(value?.id ?? value?.path ?? value?.name ?? `${key}:${index}`);
                const name = String(value?.name ?? value?.label ?? value?.path ?? id);
                return new ServiceCatalogItem(null, name, id);
            });
            return new ServiceCatalogItem(null, label, `${entries.length} objects`, entries);
        }));
        const item = new ServiceCatalogItem(null, 'Data Librarian', 'Legacy data objects', groups);
        item.id = 'servers:data-librarian';
        item.iconPath = new vscode.ThemeIcon('library');
        return item;
    }
    getTreeItem(item) {
        return item;
    }
    async getChildren(item) {
        if (!item) {
            if (this.rootItems)
                return this.rootItems;
            if (this.rootLoading)
                return [new ServiceCatalogItem(null, `Loading ${this.category}...`)];
            this.rootLoading = true;
            void this.loadChildren(undefined).then(items => {
                this.rootItems = items;
                this.rootLoading = false;
                this.changes.fire(undefined);
            }, error => {
                this.rootItems = [new ServiceCatalogItem(null, `${this.category} unavailable`, error instanceof Error ? error.message : String(error))];
                this.rootLoading = false;
                this.changes.fire(undefined);
            });
            return [new ServiceCatalogItem(null, `Loading ${this.category}...`)];
        }
        return this.loadChildren(item);
    }
    async loadChildren(item) {
        if (item) {
            return item.instances;
        }
        const base = String(vscode.workspace.getConfiguration('pulse-pmachine')
            .get('backendUrl', 'http://127.0.0.1:4000')).trim().replace(/\/$/, '');
        try {
            const response = await fetch(`${base}/api/services`, { signal: AbortSignal.timeout(15000) });
            if (!response.ok)
                throw new Error(`Services request failed (HTTP ${response.status}).`);
            const payload = await response.json();
            const offerings = parseOfferings(payload, this.category);
            const groups = new Map();
            for (const offering of offerings) {
                const key = offering.serviceId;
                const group = groups.get(key) || [];
                group.push(offering);
                groups.set(key, group);
            }
            const items = offerings.length
                ? [...groups].map(([key, group]) => {
                    if (group.length === 1)
                        return new ServiceCatalogItem(group[0], group[0].name);
                    const instances = group.map(offering => new ServiceCatalogItem(offering, [offering.nodeId, offering.instanceId || offering.endpoint].filter(Boolean).join(' / ') || offering.id));
                    const parent = new ServiceCatalogItem(null, group[0].name, `${instances.length} instances`, instances);
                    parent.id = `${this.category}:${key}`;
                    parent.iconPath = new vscode.ThemeIcon('layers');
                    return parent;
                })
                : [new ServiceCatalogItem(null, `No ${this.category} registered`)];
            if (this.category === 'servers') {
                try {
                    items.unshift(await this.dataLibrarianItem(base));
                }
                catch (error) {
                    const detail = error instanceof Error ? error.message : String(error);
                    this.output.appendLine(`Data Librarian server discovery failed: ${detail}`);
                    items.unshift(new ServiceCatalogItem(null, 'Data Librarian unavailable', detail));
                }
            }
            if (isRecord(payload) && Array.isArray(payload.errors)) {
                for (const error of payload.errors) {
                    if (!isRecord(error))
                        continue;
                    const detail = `${optionalText(error.endpoint)}: ${optionalText(error.error)}`;
                    this.output.appendLine(`${this.category} discovery failed: ${detail}`);
                    items.push(new ServiceCatalogItem(null, 'Service registry unavailable', detail));
                }
            }
            return items;
        }
        catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            const title = this.category === 'servers' ? 'Servers' : 'Services';
            this.output.appendLine(`${title} catalog failed: ${detail}`);
            void vscode.window.showErrorMessage(`Pulse ${title}: ${detail}`);
            return [new ServiceCatalogItem(null, `${title} unavailable - refresh to retry`, detail)];
        }
    }
}
export async function openServiceEndpoint(item) {
    const endpoint = item?.offering?.endpoint;
    if (!endpoint) {
        void vscode.window.showWarningMessage('This service has no configured endpoint.');
        return;
    }
    let url;
    try {
        url = new URL(endpoint);
    }
    catch {
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
//# sourceMappingURL=servicesView.js.map