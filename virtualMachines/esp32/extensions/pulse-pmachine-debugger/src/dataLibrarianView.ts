import * as vscode from 'vscode';
import { LibrarianSchema, structurePending } from './dataMapperBackend.js';
import { Field, fieldsOf } from './dataMapperModel.js';

function librarianUrl(): string {
  return String(vscode.workspace.getConfiguration('pulse-pmachine').get<string>('dataLibrarianUrl', 'http://127.0.0.1:4300')).trim().replace(/\/+$/, '');
}

async function loadSchemas(): Promise<LibrarianSchema[]> {
  const response = await fetch(`${librarianUrl()}/api/librarian/schemas`, { signal: AbortSignal.timeout(60000) });
  const data = await response.json().catch(() => ({})) as { schemas?: unknown };
  if (!response.ok) throw new Error(`Data Librarian request failed (HTTP ${response.status})`);
  if (!Array.isArray(data.schemas)) throw new Error('Data Librarian returned an invalid schemas list.');
  return data.schemas as LibrarianSchema[];
}

async function schemaStructure(path: string): Promise<{ structure: unknown; mtime?: string }> {
  const response = await fetch(`${librarianUrl()}/api/librarian/schema-structure?path=${encodeURIComponent(path)}`, { signal: AbortSignal.timeout(60000) });
  const data = await response.json().catch(() => ({})) as { structure?: unknown; mtime?: unknown };
  if (!response.ok) throw new Error(`Data Librarian structure request failed (HTTP ${response.status})`);
  return { structure: data.structure ?? null, ...(typeof data.mtime === 'string' ? { mtime: data.mtime } : {}) };
}
const collections = [
  ['Files', '/api/librarian/files', 'files'],
  ['Schemas', '/api/librarian/schemas', 'schemas'],
  ['Subschemas', '/api/librarian/subschemas', 'subschemas'],
  ['Data Types', '/api/librarian/data-types', 'dataTypes'],
  ['Mapper Rulesets', '/api/librarian/mapper-rulesets', 'mapperRulesets'],
] as const;

async function loadCollection(path: string, key: string): Promise<unknown[]> {
  const response = await fetch(`${librarianUrl()}${path}`, { signal: AbortSignal.timeout(60000) });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(`Data Librarian request failed (HTTP ${response.status})`);
  if (!Array.isArray(data[key])) throw new Error(`Data Librarian returned an invalid ${key} collection.`);
  return data[key];
}

class LibrarianGroupItem extends vscode.TreeItem {
  constructor(label: string, readonly children: vscode.TreeItem[], error?: string) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = error || `${children.length} objects`;
    this.tooltip = error;
    this.iconPath = new vscode.ThemeIcon(error ? 'warning' : 'library');
  }
}

export class LibrarianItem extends vscode.TreeItem {
  constructor(label: string, readonly schema?: LibrarianSchema, readonly fields: Field[] = [], readonly field?: Field,
    readonly baseUrl?: string) {
    const children = field
      ? fields.some(entry => entry.depth === field.depth + 1 && entry.path.startsWith(`${field.path}.`))
      : schema ? (structurePending(schema) || fields.length > 0) : false;
    super(label, children ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
    if (!schema) return;
    this.id = JSON.stringify([schema.path, field?.path ?? null]);
    this.description = field ? field.valueType : schema.typeId;
    this.tooltip = field ? `${field.path}\n${field.valueType}` : `${schema.name || schema.path}\n${schema.path}`;
    this.iconPath = new vscode.ThemeIcon(field ? (children ? 'symbol-object' : 'symbol-field') : 'symbol-structure');
    this.contextValue = 'pulseLibrarianSchema';
  }
}

export class DataLibrarianViewProvider implements vscode.TreeDataProvider<LibrarianItem>, vscode.Disposable {
  private readonly changes = new vscode.EventEmitter<LibrarianItem | undefined>();
  readonly onDidChangeTreeData = this.changes.event;

  private readonly loaded = new Map<string, LibrarianSchema>();
  private rootItems: LibrarianItem[] | undefined;
  private rootLoading = false;

  constructor(private readonly output: vscode.OutputChannel) {}

  prefetch(): void { void this.getChildren(); }

  refresh(): void { this.loaded.clear(); this.rootItems = undefined; this.rootLoading = false; this.changes.fire(undefined); }
  dispose(): void { this.changes.dispose(); }
  getTreeItem(item: LibrarianItem): vscode.TreeItem { return item; }

  async loadSchema(item: LibrarianItem): Promise<LibrarianSchema | undefined> {
    if (!item.schema) return undefined;
    if (!structurePending(item.schema)) return item.schema;
    const cached = this.loaded.get(item.schema.path);
    if (cached) return cached;
    const structure = await schemaStructure(item.schema.path);
    const schema = { ...item.schema, structure: structure.structure, structureLoaded: true, ...(structure.mtime ? { mtime: structure.mtime } : {}) };
    this.loaded.set(schema.path, schema);
    return schema;
  }

  async getChildren(item?: LibrarianItem): Promise<LibrarianItem[]> {
    if (!item) {
      if (this.rootItems) return this.rootItems;
      if (this.rootLoading) return [new LibrarianItem('Loading Data Librarian...')];
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

  private async loadChildren(item?: LibrarianItem): Promise<LibrarianItem[]> {
    if (item) {
      if (item instanceof LibrarianGroupItem) return item.children as LibrarianItem[];
      if (!item.schema) return [];
      let schema = item.schema;
      let fields = item.fields;
      if (!item.field && structurePending(schema)) {
        try {
          schema = (await this.loadSchema(item))!;
          fields = fieldsOf({ rules: [], sourceStructure: schema.structure }, 'source');
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          this.output.appendLine(`Data Librarian: ${schema.path}: ${detail}`);
          const failed = new LibrarianItem('Field structure unavailable - refresh to retry');
          failed.tooltip = detail;
          return [failed];
        }
        if (!fields.length) return [new LibrarianItem('(no field structure)')];
      }
      return fields.filter(field => item.field
        ? field.depth === item.field.depth + 1 && field.path.startsWith(`${item.field.path}.`)
        : field.depth === 0)
        .map(field => new LibrarianItem(field.path, schema, fields, field, item.baseUrl));
    }
    if (!vscode.workspace.isTrusted) return [new LibrarianItem('Trust this workspace to browse Librarian schemas')];
    try {
      return Promise.all(collections.map(async ([label, path, key]) => {
        try {
          const values = key === 'schemas' ? await loadSchemas() : await loadCollection(path, key);
          const items = values.map((value, index) => {
            if (key === 'schemas') {
              const schema = value as LibrarianSchema;
              const item = new LibrarianItem(schema.name || schema.path, schema,
                fieldsOf({ rules: [], sourceStructure: schema.structure }, 'source'), undefined, librarianUrl());
              if (!item.fields.length && !structurePending(schema)) item.description = `${schema.typeId || ''} (no field structure)`.trim();
              return item;
            }
            const record = value as Record<string, unknown>;
            const id = String(record.id ?? record.path ?? record.name ?? `${key}:${index}`);
            const item = new vscode.TreeItem(String(record.name ?? record.label ?? record.path ?? id));
            item.id = `librarian:${key}:${id}`;
            item.description = id;
            item.contextValue = 'pulseLibrarianObject';
            return item;
          });
          return new LibrarianGroupItem(label, items);
        } catch (error) {
          return new LibrarianGroupItem(label, [], error instanceof Error ? error.message : String(error));
        }
      }));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.output.appendLine(`Data Librarian: ${detail}`);
      void vscode.window.showErrorMessage(`Pulse Data Librarian: ${detail}`);
      const item = new LibrarianItem('Data Librarian unavailable - refresh to retry');
      item.tooltip = detail;
      return [item];
    }
  }
}

export async function openLibrarianSchema(item?: LibrarianItem, provider?: DataLibrarianViewProvider): Promise<void> {
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
  } catch (error) {
    void vscode.window.showErrorMessage(`Pulse Data Librarian: ${error instanceof Error ? error.message : String(error)}`);
  }
}
