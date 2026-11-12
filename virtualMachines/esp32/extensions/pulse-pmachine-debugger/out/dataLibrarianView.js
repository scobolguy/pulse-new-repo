import * as vscode from 'vscode';
import { structurePending } from './dataMapperBackend.js';
import { fieldsOf } from './dataMapperModel.js';
function librarianUrl() {
    return String(vscode.workspace.getConfiguration('pulse-pmachine').get('dataLibrarianUrl', 'http://127.0.0.1:4300')).trim().replace(/\/+$/, '');
}
async function loadSchemas() {
    const response = await fetch(`${librarianUrl()}/api/librarian/schemas`, { signal: AbortSignal.timeout(60000) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
        throw new Error(`Data Librarian request failed (HTTP ${response.status})`);
    if (!Array.isArray(data.schemas))
        throw new Error('Data Librarian returned an invalid schemas list.');
    return data.schemas;
}
async function schemaStructure(path) {
    const response = await fetch(`${librarianUrl()}/api/librarian/schema-structure?path=${encodeURIComponent(path)}`, { signal: AbortSignal.timeout(60000) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
        throw new Error(`Data Librarian structure request failed (HTTP ${response.status})`);
    return { structure: data.structure ?? null, ...(typeof data.mtime === 'string' ? { mtime: data.mtime } : {}) };
}
const collections = [
    ['Files', '/api/librarian/files', 'files'],
    ['Schemas', '/api/librarian/schemas', 'schemas'],
    ['Subschemas', '/api/librarian/subschemas', 'subschemas'],
    ['Data Types', '/api/librarian/data-types', 'dataTypes'],
    ['Mapper Rulesets', '/api/librarian/mapper-rulesets', 'mapperRulesets'],
];
async function loadCollection(path, key) {
    const response = await fetch(`${librarianUrl()}${path}`, { signal: AbortSignal.timeout(60000) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
        throw new Error(`Data Librarian request failed (HTTP ${response.status})`);
    if (!Array.isArray(data[key]))
        throw new Error(`Data Librarian returned an invalid ${key} collection.`);
    return data[key];
}
class LibrarianGroupItem extends vscode.TreeItem {
    children;
    constructor(label, children, error) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.children = children;
        this.description = error || `${children.length} objects`;
        this.tooltip = error;
        this.iconPath = new vscode.ThemeIcon(error ? 'warning' : 'library');
    }
}
export class LibrarianItem extends vscode.TreeItem {
    schema;
    fields;
    field;
    baseUrl;
    constructor(label, schema, fields = [], field, baseUrl) {
        const children = field
            ? fields.some(entry => entry.depth === field.depth + 1 && entry.path.startsWith(`${field.path}.`))
            : schema ? (structurePending(schema) || fields.length > 0) : false;
        super(label, children ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        this.schema = schema;
        this.fields = fields;
        this.field = field;
        this.baseUrl = baseUrl;
        if (!schema)
            return;
        this.id = JSON.stringify([schema.path, field?.path ?? null]);
        this.description = field ? field.valueType : schema.typeId;
        this.tooltip = field ? `${field.path}\n${field.valueType}` : `${schema.name || schema.path}\n${schema.path}`;
        this.iconPath = new vscode.ThemeIcon(field ? (children ? 'symbol-object' : 'symbol-field') : 'symbol-structure');
        this.contextValue = 'pulseLibrarianSchema';
    }
}
export class DataLibrarianViewProvider {
    output;
    changes = new vscode.EventEmitter();
    onDidChangeTreeData = this.changes.event;
    loaded = new Map();
    rootItems;
    rootLoading = false;
    constructor(output) {
        this.output = output;
    }
    prefetch() { void this.getChildren(); }
    refresh() { this.loaded.clear(); this.rootItems = undefined; this.rootLoading = false; this.changes.fire(undefined); }
    dispose() { this.changes.dispose(); }
    getTreeItem(item) { return item; }
    async loadSchema(item) {
        if (!item.schema)
            return undefined;
        if (!structurePending(item.schema))
            return item.schema;
        const cached = this.loaded.get(item.schema.path);
        if (cached)
            return cached;
        const structure = await schemaStructure(item.schema.path);
        const schema = { ...item.schema, structure: structure.structure, structureLoaded: true, ...(structure.mtime ? { mtime: structure.mtime } : {}) };
        this.loaded.set(schema.path, schema);
        return schema;
    }
    async getChildren(item) {
        if (!item) {
            if (this.rootItems)
                return this.rootItems;
            if (this.rootLoading)
                return [new LibrarianItem('Loading Data Librarian...')];
            this.rootLoading = true;
            void this.loadChildren().then(items => {
                this.rootItems = items;
                this.rootLoading = false;
                this.changes.fire(undefined);
            }, error => {
                this.rootItems = [new LibrarianItem(`Data Librarian unavailable - ${error instanceof Error ? error.message : String(error)}`)];
                this.rootLoading = false;
                this.changes.fire(undefined);
            });
            return [new LibrarianItem('Loading Data Librarian...')];
        }
        return this.loadChildren(item);
    }
    async loadChildren(item) {
        if (item) {
            if (item instanceof LibrarianGroupItem)
                return item.children;
            if (!item.schema)
                return [];
            let schema = item.schema;
            let fields = item.fields;
            if (!item.field && structurePending(schema)) {
                try {
                    schema = (await this.loadSchema(item));
                    fields = fieldsOf({ rules: [], sourceStructure: schema.structure }, 'source');
                }
                catch (error) {
                    const detail = error instanceof Error ? error.message : String(error);
                    this.output.appendLine(`Data Librarian: ${schema.path}: ${detail}`);
                    const failed = new LibrarianItem('Field structure unavailable - refresh to retry');
                    failed.tooltip = detail;
                    return [failed];
                }
                if (!fields.length)
                    return [new LibrarianItem('(no field structure)')];
            }
            return fields.filter(field => item.field
                ? field.depth === item.field.depth + 1 && field.path.startsWith(`${item.field.path}.`)
                : field.depth === 0)
                .map(field => new LibrarianItem(field.path, schema, fields, field, item.baseUrl));
        }
        if (!vscode.workspace.isTrusted)
            return [new LibrarianItem('Trust this workspace to browse Librarian schemas')];
        try {
            return Promise.all(collections.map(async ([label, path, key]) => {
                try {
                    const values = key === 'schemas' ? await loadSchemas() : await loadCollection(path, key);
                    const items = values.map((value, index) => {
                        if (key === 'schemas') {
                            const schema = value;
                            const item = new LibrarianItem(schema.name || schema.path, schema, fieldsOf({ rules: [], sourceStructure: schema.structure }, 'source'), undefined, librarianUrl());
                            if (!item.fields.length && !structurePending(schema))
                                item.description = `${schema.typeId || ''} (no field structure)`.trim();
                            return item;
                        }
                        const record = value;
                        const id = String(record.id ?? record.path ?? record.name ?? `${key}:${index}`);
                        const item = new vscode.TreeItem(String(record.name ?? record.label ?? record.path ?? id));
                        item.id = `librarian:${key}:${id}`;
                        item.description = id;
                        item.contextValue = 'pulseLibrarianObject';
                        return item;
                    });
                    return new LibrarianGroupItem(label, items);
                }
                catch (error) {
                    return new LibrarianGroupItem(label, [], error instanceof Error ? error.message : String(error));
                }
            }));
        }
        catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            this.output.appendLine(`Data Librarian: ${detail}`);
            void vscode.window.showErrorMessage(`Pulse Data Librarian: ${detail}`);
            const item = new LibrarianItem('Data Librarian unavailable - refresh to retry');
            item.tooltip = detail;
            return [item];
        }
    }
}
export async function openLibrarianSchema(item, provider) {
    if (!item?.schema) {
        void vscode.window.showWarningMessage('Select a Data Librarian schema to open its details.');
        return;
    }
    try {
        const schema = provider ? (await provider.loadSchema(item)) ?? item.schema : item.schema;
        const document = await vscode.workspace.openTextDocument({
            language: 'json', content: `${JSON.stringify(schema, null, 2)}\n`,
        });
        await vscode.window.showTextDocument(document, { preview: true });
    }
    catch (error) {
        void vscode.window.showErrorMessage(`Pulse Data Librarian: ${error instanceof Error ? error.message : String(error)}`);
    }
}
//# sourceMappingURL=dataLibrarianView.js.map