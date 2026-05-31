import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const grammarDir = path.join(root, 'grammar');
const outputDir = path.join(grammarDir, 'generated-modern');
const jarPath = path.join(root, 'tools', 'antlr-4.13.2-complete.jar');

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${error.message}\n${stderr || ''}`.trim()));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function ensureJar() {
  try {
    await fs.access(jarPath);
  } catch {
    throw new Error(`ANTLR jar not found at ${jarPath}. Download https://www.antlr.org/download/antlr-4.13.2-complete.jar to tools/.`);
  }
}

async function generateForGrammar(grammarFile) {
  const args = [
    '-jar',
    jarPath,
    '-Dlanguage=JavaScript',
    '-visitor',
    '-no-listener',
    '-o',
    outputDir,
    path.join(grammarDir, grammarFile)
  ];
  await run('java', args, root);
}

async function main() {
  await ensureJar();
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });
  await generateForGrammar('PascalishRouterMapper.g4');
  await generateForGrammar('WorkflowDsl.g4');
  console.log('[ANTLR] Generated modern JS parsers into grammar/generated-modern');
}

main().catch(err => {
  console.error('[ANTLR] Failed:', err.message);
  process.exitCode = 1;
});
