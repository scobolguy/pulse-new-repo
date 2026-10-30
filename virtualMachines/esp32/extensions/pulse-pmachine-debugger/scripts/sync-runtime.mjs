import fs from 'node:fs/promises';
import { isBuiltin } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const extensionRoot = fileURLToPath(new URL('../', import.meta.url));
const repositoryRoot = path.resolve(extensionRoot, '../../../..');
const destination = path.join(extensionRoot, 'out', 'runtime');
const esp32 = path.join('virtualMachines', 'esp32');
const scripts = path.join(esp32, 'aggregator', 'scripts');
const manifest = JSON.parse(await fs.readFile(path.join(extensionRoot, 'package.json'), 'utf8'));
const pending = [
  ...[
    'compile-csharp-to-pcode.mjs',
    'compile-mnf-to-pcode.mjs',
    'compile-tandem-cobol85-to-pcode.mjs',
    'compile-pascalish-program-antlr-to-pcode.mjs',
    'compile-interoperable-language.mjs',
    'run-js-pmachine.mjs',
    'run-pascal-on-esp32-node.mjs',
  ].map(name => path.join(scripts, name)),
  path.join('languages', 'mapl', 'src', 'compile-mapl-antlr-to-pcode.mjs'),
  path.join('languages', 'wfl', 'src', 'compile-workflow-dsl.mjs'),
  path.join('languages', 'wfl', 'src', 'compile-workflow-to-pcode.mjs'),
  path.join(esp32, 'aggregator', 'src', 'backend', 'modules', 'javascriptPmachineDebugger.mjs'),
  path.join(esp32, 'aggregator', 'src', 'backend', 'modules', 'esp32PmachineDebugBridge.mjs'),
  path.join(esp32, 'pmachines', 'javascript', 'index.mjs'),
  ...[
    'desktop-text-bindings.mjs', 'desktop-date-bindings.mjs', 'desktop-intrinsic-bindings.mjs',
    'filesystem-bindings.mjs', 'isam-bindings.mjs', 'fortran-context.mjs', 'service-host.mjs',
  ].map(name => path.join(esp32, 'pmachines', 'javascript', 'src', name)),
  path.join('languages', 'cobolish85', 'src', 'fixed-format.mjs'),
  path.join('languages', 'assemblerish', 'src', 'compile-assemblerish-to-pcode.mjs'),
  path.join('languages', 'assemblerish', 'compile.mjs'),
  path.join('languages', 'assemblerish', 'deploy.mjs'),
  path.join('languages', 'assemblerish', 'install-timer-dot.mjs'),
  path.join('languages', 'screencobol', 'src', 'compiler.mjs'),
];
const copied = new Set();

await fs.rm(destination, { recursive: true, force: true });
await fs.mkdir(destination, { recursive: true });
await fs.writeFile(path.join(destination, 'package.json'), '{"type":"module"}\n');

async function copy(relative) {
  const target = path.join(destination, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.cp(path.join(repositoryRoot, relative), target, { recursive: true });
}

while (pending.length) {
  const relative = pending.pop();
  if (copied.has(relative)) continue;
  if (path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`)) {
    throw new Error(`Runtime dependency escapes the repository: ${relative}`);
  }
  copied.add(relative);
  const source = await fs.readFile(path.join(repositoryRoot, relative), 'utf8');
  await copy(relative);
  const syntax = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function dependency(specifier) {
    if (specifier.startsWith('.')) {
      pending.push(path.normalize(path.join(path.dirname(relative), specifier)));
    } else if (!isBuiltin(specifier)) {
      const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
      if (!manifest.dependencies?.[name]) {
        throw new Error(`Declare runtime dependency "${name}" in the extension package.json (used by ${relative}).`);
      }
    }
  }
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier
      && ts.isStringLiteral(node.moduleSpecifier)) {
      dependency(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
      || ts.isIdentifier(node.expression) && node.expression.text === 'require')
      && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
      dependency(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(syntax);
}

// These resources are read from disk rather than imported as modules.
for (const relative of [
  path.join(esp32, 'pmachines', 'shared', 'contracts', 'pcode-opcodes.manifest.json'),
  path.join('languages', 'pascalish', 'libraries'),
  path.join('languages', 'cobolish85', 'runtime'),
  path.join('languages', 'dotnet', 'libraries'),
  path.join('languages', 'assemblerish', 'README.md'),
  path.join('languages', 'assemblerish', 'HAL-TUTORIAL.md'),
  path.join('languages', 'assemblerish', 'examples'),
  path.join('languages', 'screencobol', 'README.md'),
]) await copy(relative);

console.log(`Packaged ${copied.size} compiler/runtime modules and their libraries.`);
