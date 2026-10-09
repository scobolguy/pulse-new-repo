import * as vscode from 'vscode';
import { DataMapperBackend, LibrarianSchema } from './dataMapperBackend.js';
import { Field, fieldsOf } from './dataMapperModel.js';

export class LibrarianItem extends vscode.TreeItem {
  constructor(label: string, readonly schema?: LibrarianSchema, readonly fields: Field[] = [], readonly field?: Field) {
    const children = field
      ? fields.some(entry => entry.depth === field.depth + 1 && entry.path.startsWith(`${field.path}.`))
      : fields.length > 0;
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

  constructor(private readonly output: vscode.OutputChannel) {}

  refresh(): void { this.changes.fire(undefined); }
  dispose(): void { this.changes.dispose(); }
  getTreeItem(item: LibrarianItem): vscode.TreeItem { return item; }

  async getChildren(item?: LibrarianItem): Promise<LibrarianItem[]> {
    if (item) {
      if (!item.schema) return [];
      return item.fields.filter(field => item.field
        ? field.depth === item.field.depth + 1 && field.path.startsWith(`${item.field.path}.`)
        : field.depth === 0)
        .map(field => new LibrarianItem(field.path, item.schema, item.fields, field));
    }
    if (!vscode.workspace.isTrusted) return [new LibrarianItem('Trust this workspace to browse Librarian schemas')];
    try {
      const base = vscode.workspace.getConfiguration('pulse-pmachine').get<string>('backendUrl', 'http://127.0.0.1:4000');
      const schemas = await new DataMapperBackend(base).schemas();
      return schemas.length
        ? schemas.sort((left, right) => (left.name || left.path).localeCompare(right.name || right.path))
          .map(schema => {
            const item = new LibrarianItem(schema.name || schema.path, schema,
              fieldsOf({ rules: [], sourceStructure: schema.structure }, 'source'));
            if (!item.fields.length) item.description = `${schema.typeId || ''} (no field structure)`.trim();
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

export async function openLibrarianSchema(item?: LibrarianItem): Promise<void> {
  if (!item?.schema) {
    void vscode.window.showWarningMessage('Select a Data Librarian schema to open its details.');
    return;
  }
  try {
    const document = await vscode.workspace.openTextDocument({
      language: 'json', content: `${JSON.stringify(item.schema, null, 2)}\n`,
    });
    await vscode.window.showTextDocument(document, { preview: true });
  } catch (error) {
    void vscode.window.showErrorMessage(`Pulse Data Librarian: ${error instanceof Error ? error.message : String(error)}`);
  }
}
