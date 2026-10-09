import * as vscode from 'vscode';
import { DataMapperBackend, LibrarianSchema, structurePending } from './dataMapperBackend.js';
import { Field, fieldsOf } from './dataMapperModel.js';

const DIRECT_LIBRARIAN_URL = 'http://127.0.0.1:4300';

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
    this.command = { command: 'pulse-pmachine.openLibrarianSchema', title: 'Open Schema Details', arguments: [this] };
  }
}

export class DataLibrarianViewProvider implements vscode.TreeDataProvider<LibrarianItem>, vscode.Disposable {
  private readonly changes = new vscode.EventEmitter<LibrarianItem | undefined>();
  readonly onDidChangeTreeData = this.changes.event;

  private readonly loaded = new Map<string, LibrarianSchema>();

  constructor(private readonly output: vscode.OutputChannel) {}

  refresh(): void { this.loaded.clear(); this.changes.fire(undefined); }
  dispose(): void { this.changes.dispose(); }
  getTreeItem(item: LibrarianItem): vscode.TreeItem { return item; }

  async loadSchema(item: LibrarianItem): Promise<LibrarianSchema | undefined> {
    if (!item.schema) return undefined;
    if (!structurePending(item.schema)) return item.schema;
    const cached = this.loaded.get(item.schema.path);
    if (cached) return cached;
    const base = item.baseUrl ?? vscode.workspace.getConfiguration('pulse-pmachine').get<string>('backendUrl', 'http://127.0.0.1:4000');
    const schema = await new DataMapperBackend(base).schemaWithStructure(item.schema);
    this.loaded.set(schema.path, schema);
    return schema;
  }

  async getChildren(item?: LibrarianItem): Promise<LibrarianItem[]> {
    if (item) {
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
      let base = vscode.workspace.getConfiguration('pulse-pmachine').get<string>('backendUrl', 'http://127.0.0.1:4000');
      let schemas: LibrarianSchema[];
      try { schemas = await new DataMapperBackend(base).schemas(); }
      catch (error) {
        // Fall back to the Librarian itself only when the backend proxy is unreachable.
        if (!(error instanceof TypeError) && (error as Error)?.name !== 'TimeoutError') throw error;
        this.output.appendLine(`Data Librarian: ${base} unreachable; trying ${DIRECT_LIBRARIAN_URL}`);
        base = DIRECT_LIBRARIAN_URL;
        schemas = await new DataMapperBackend(DIRECT_LIBRARIAN_URL).schemas();
      }
      return schemas.length
        ? schemas.sort((left, right) => (left.name || left.path).localeCompare(right.name || right.path))
          .map(schema => {
            const item = new LibrarianItem(schema.name || schema.path, schema,
              fieldsOf({ rules: [], sourceStructure: schema.structure }, 'source'), undefined, base);
            if (!item.fields.length && !structurePending(schema)) item.description = `${schema.typeId || ''} (no field structure)`.trim();
            return item;
          })
        : [new LibrarianItem('No schemas registered in Data Librarian')];
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
