import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

function runCommand(label, commandLine, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(commandLine, {
      cwd: root,
      shell: true,
      stdio: 'inherit',
      ...options
    });

    child.on('error', (err) => {
      console.error(`[simple-smoke] ${label} failed to start: ${err.message}`);
      resolve({ label, code: 1 });
    });

    child.on('close', (code) => {
      resolve({ label, code: code ?? 1 });
    });
  });
}

async function main() {
  const results = [];

  results.push(await runCommand(
    'P-code compatibility check',
    'npm run check:pcode-compat'
  ));

  results.push(await runCommand(
    'Towers of Hanoi proof run',
    'npm run proof:hanoi:js-pmachine'
  ));

  results.push(await runCommand(
    'JS PMachine spec opcode coverage',
    'npm run test:js-pmachine:spec-opcodes'
  ));

  results.push(await runCommand(
    'P-code compiler string escaping fidelity',
    'npm run test:pcode-compiler:string-escaping'
  ));

  results.push(await runCommand(
    'Pascalish endpoint/transaction BNF syntax',
    'npm run test:pascalish:endpoint-bnf'
  ));

  results.push(await runCommand(
    'JS PMachine negative opcode behavior',
    'npm run test:js-pmachine:negative-opcodes'
  ));

  results.push(await runCommand(
    'JS PMachine failure-path behavior',
    'npm run test:js-pmachine:failure-paths'
  ));

  const antlrJar = path.join(root, 'tools', 'antlr-4.13.2-complete.jar');
  if (!fs.existsSync(antlrJar)) {
    results.push({ label: 'ANTLR smoke generation (Pascalish/WFL/MAPL)', code: 2 });
    console.error('[simple-smoke] ANTLR jar missing, skipping grammar generation smoke');
  } else {
    const generatedOut = path.join(root, 'grammar', 'generated-test');
    fs.mkdirSync(generatedOut, { recursive: true });

    const grammarFiles = ['Pascalish.g4', 'WFL.g4', 'MAPL.g4'];
    let antlrCode = 0;

    for (const grammar of grammarFiles) {
      const one = await runCommand(
        `ANTLR generate ${grammar}`,
        `java -jar "${antlrJar}" -Dlanguage=JavaScript -visitor -no-listener -o "${generatedOut}" "${path.join(root, 'grammar', grammar)}"`
      );
      if (one.code !== 0) {
        antlrCode = one.code;
        break;
      }
    }

    results.push({ label: 'ANTLR smoke generation (Pascalish/WFL/MAPL)', code: antlrCode });
  }

  console.log('\n[simple-smoke] Summary');
  console.log('----------------------------------------');
  for (const r of results) {
    const status = r.code === 0 ? 'PASS' : (r.code === 2 ? 'SKIP' : 'FAIL');
    console.log(`${status.padEnd(5)} ${r.label}`);
  }

  const hasFail = results.some(r => r.code !== 0 && r.code !== 2);
  process.exitCode = hasFail ? 1 : 0;
}

main().catch((err) => {
  console.error('[simple-smoke] Unhandled error:', err.message);
  process.exitCode = 1;
});
