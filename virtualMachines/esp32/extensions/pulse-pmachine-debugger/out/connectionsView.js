import * as vscode from 'vscode';

const DEFAULT_CONNECTION_SERVICES = Object.freeze([
    { id: 'message-broker', name: 'Message Broker', kind: 'messaging' },
    { id: 'database', name: 'Database', kind: 'database' },
    { id: 'data-librarian', name: 'Data Librarian', kind: 'librarian' },
    { id: 'code-librarian', name: 'Code Librarian', kind: 'librarian' },
    { id: 'mapper-librarian', name: 'Mapper Librarian', kind: 'librarian' },
    { id: 'pulse-gateway', name: 'Pulse Gateway', kind: 'api' },
    { id: 'pulse-discovery', name: 'Pulse Discovery', kind: 'discovery' },
    { id: 'pulse-data-mapper', name: 'Pulse Data Mapper', kind: 'mapper' },
    { id: 'pulse-filesystem', name: 'Pulse Filesystem', kind: 'storage' },
    { id: 'pulse-queue-manager', name: 'Pulse Queue Manager', kind: 'queue' },
]);

const CONFIGURATION_KEY = 'connections';
const SECRET_PREFIX = 'pulse.connection.';

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeConnection(value) {
    if (!isRecord(value))
        return null;
    const id = text(value.id);
    const name = text(value.name);
    const endpoint = text(value.endpoint);
    if (!id || !name || !endpoint)
        return null;
    return { id, name, kind: text(value.kind), endpoint, updatedAt: text(value.updatedAt) };
}

function configuredConnections() {
    const value = vscode.workspace.getConfiguration('pulse-pmachine').get(CONFIGURATION_KEY, []);
    return Array.isArray(value) ? value.map(normalizeConnection).filter(Boolean) : [];
}

function connectionServices() {
    const configured = vscode.workspace.getConfiguration('pulse-pmachine')
        .get('connectionServices', []);
    const custom = Array.isArray(configured) ? configured
        .filter(isRecord)
        .map(service => ({ id: text(service.id), name: text(service.name), kind: text(service.kind) }))
        .filter(service => service.id && service.name) : [];
    const services = new Map(DEFAULT_CONNECTION_SERVICES.map(service => [service.id, service]));
    for (const service of custom)
        services.set(service.id, service);
    return [...services.values()];
}

export class PulseConnectionItem extends vscode.TreeItem {
    constructor(service, connection = null) {
        super(connection || service ? (connection?.name || service.name) : 'Pulse Connections',
            vscode.TreeItemCollapsibleState.None);
        this.service = service;
        this.connection = connection;
        this.id = service.id;
        this.contextValue = connection ? 'pulseConnection' : 'pulseConnectionUndefined';
        this.description = connection?.endpoint || '(not defined)';
        this.tooltip = connection
            ? `${connection.name}\n${connection.endpoint}`
            : `${service.name} is not defined. Right-click to create a connection string.`;
        this.iconPath = new vscode.ThemeIcon(connection ? 'plug' : 'warning');
        if (connection) {
            this.command = {
                command: 'pulse-pmachine.openConnectionEndpoint',
                title: 'Open Connection Endpoint',
                arguments: [this],
            };
        }
    }
}

export class ConnectionsViewProvider {
    changes = new vscode.EventEmitter();
    onDidChangeTreeData = this.changes.event;

    constructor(output, secrets) {
        this.output = output;
        this.secrets = secrets;
    }

    refresh() {
        this.changes.fire(undefined);
    }

    dispose() {
        this.changes.dispose();
    }

    getTreeItem(item) {
        return item;
    }

    async getChildren() {
        const connections = new Map(configuredConnections().map(connection => [connection.id, connection]));
        return connectionServices().map(service =>
            new PulseConnectionItem(service, connections.get(service.id) || null));
    }
}

export async function createConnectionString(item) {
    const service = item?.service;
    if (!service)
        return;
    const address = await vscode.window.showInputBox({
        title: `Configure ${service.name}`,
        prompt: 'Server address, DNS name, or IP address',
        placeHolder: '127.0.0.1',
        validateInput: value => text(value) ? undefined : 'An address is required.',
    });
    if (address === undefined)
        return;
    const portText = await vscode.window.showInputBox({
        title: `Configure ${service.name}`,
        prompt: 'Server port',
        placeHolder: '4000',
        validateInput: value => /^\d{1,5}$/.test(text(value)) && Number(value) <= 65535
            ? undefined : 'Enter a TCP port from 1 to 65535.',
    });
    if (portText === undefined)
        return;
    const protocol = await vscode.window.showInputBox({
        title: `Configure ${service.name}`,
        prompt: 'Protocol or scheme',
        value: service.kind === 'messaging' ? 'amqp' : 'http',
        validateInput: value => /^[a-z][a-z0-9+.-]*$/i.test(text(value))
            ? undefined : 'Enter a valid protocol name.',
    });
    if (protocol === undefined)
        return;
    const endpoint = `${text(protocol)}://${text(address)}:${Number(portText)}`;
    const existing = configuredConnections().filter(connection => connection.id !== service.id);
    existing.push({ id: service.id, name: service.name, kind: service.kind, endpoint, updatedAt: new Date().toISOString() });
    await vscode.workspace.getConfiguration('pulse-pmachine').update(
        CONFIGURATION_KEY, existing, vscode.ConfigurationTarget.Workspace);
    void vscode.window.showInformationMessage(`${service.name} connection saved: ${endpoint}`);
}

export async function openConnectionEndpoint(item) {
    const endpoint = item?.connection?.endpoint;
    if (!endpoint)
        return;
    let url;
    try {
        url = new URL(endpoint);
    }
    catch {
        void vscode.window.showErrorMessage('The configured connection endpoint is not a valid URL.');
        return;
    }
    if (!await vscode.env.openExternal(vscode.Uri.parse(url.href)))
        void vscode.window.showErrorMessage(`Unable to open connection endpoint: ${endpoint}`);
}
