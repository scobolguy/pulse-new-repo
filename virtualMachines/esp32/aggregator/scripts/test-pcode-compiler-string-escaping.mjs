import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function runNode(args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd, shell: false });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      resolve({ code: 1, stdout, stderr: `${stderr}\n${error.message}`.trim() });
    });

    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const root = path.resolve(__dirname, '..');

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pcode-escape-'));
  const dslPath = path.join(tmpDir, 'fidelity.service.pas');
  const pcodePath = path.join(tmpDir, 'fidelity.service.pcode');
  const mapPath = path.join(tmpDir, 'fidelity.service.program.json');

  const dsl = [
    'SERVICE "mt103-to-pacs-service";',
    'BEGIN',
    '  CASE httpVerb OF',
    '    httpVerb.post: RETURN src;',
    '    httpVerb.get: RETURN "mt103-to-pacs-service";',
    '  END;',
    'END;',
    '',
    'ROUTER "mt103-to-pacs-router" INPUT "swift.mt103.parsed" DESCRIPTION "Transform MT103 payload to PACS payload" ENABLED TRUE BEGIN',
    '  OUTPUT "tx.pacs.created" TYPE "pacs"',
    '    WHEN "IF startswith(upper(src), \\"MT103\\") THEN output := 1 ELSE output := 0;"',
    '    TRANSFORM "output := map(\\"mt103-to-pacs\\", src);";',
    'END;',
    '',
    'MAPPER "mt103-to-pacs" SOURCE "swift-mt103" TARGET "pacs" DESCRIPTION "MT103 to PACS.008 mapping" ENABLED TRUE BEGIN',
    '  MAP "block4.20" TO "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" USING "output := trim(src);";',
    'END;'
  ].join('\n');

  await fs.writeFile(dslPath, `${dsl}\n`, 'utf-8');

  const compileRun = await runNode(
    ['scripts/compile-pascal-to-pcode.mjs', '--in', dslPath, '--out', pcodePath, '--map-out', mapPath],
    root
  );
  if (compileRun.code !== 0) {
    throw new Error(`compile failed (${compileRun.code}): ${compileRun.stderr || compileRun.stdout}`);
  }

  const mapRaw = await fs.readFile(mapPath, 'utf-8');
  const programMap = JSON.parse(mapRaw);
  const router = (programMap.entries || []).find((entry) => entry.kind === 'router' && entry.id === 'mt103-to-pacs-router');
  assert.ok(router, 'router entry not found in program map');

  const firstOutput = router.outputs?.[0] || {};
  assert.equal(
    firstOutput.whenRule,
    'IF startswith(upper(src), "MT103") THEN output := 1 ELSE output := 0;',
    'compiler should normalize escaped quotes in whenRule'
  );
  assert.equal(
    firstOutput.transformRule,
    'output := map("mt103-to-pacs", src);',
    'compiler should normalize escaped quotes in transformRule'
  );

  const run = await runNode(
    [
      'scripts/run-js-pmachine.mjs',
      '--pcode', pcodePath,
      '--program-map', mapPath,
      '--input-queue', 'swift.mt103.parsed',
      '--message', 'MT103\\n:20:REF-123\\n:32A:260705USD12500,\\n:50K:/12345678\\nACME CORP\\n:59:/99988877\\nBENEFICIARY LTD\\n:70:Invoice 445\\n:71A:OUR'
    ],
    root
  );

  if (run.code !== 0) {
    throw new Error(`run-js-pmachine failed (${run.code}): ${run.stderr || run.stdout}`);
  }

  const output = JSON.parse(run.stdout);
  assert.equal(output.publishedCount, 1, 'compiled fidelity rules should emit one transformed message');

  const delivery = (output.deliveries || [])[0] || {};
  const mapped = JSON.parse(String(delivery.message || '{}'));
  const hdr = mapped?.Document?.FIToFICstmrCdtTrf?.GrpHdr || {};
  assert.equal(hdr.MsgId, 'REF-123', 'MsgId should map from MT103 :20:');

  console.log('[pcode-compiler-escape] PASS: fidelity escaped strings compile and route correctly');
}

main().catch((error) => {
  console.error('[pcode-compiler-escape] FAIL:', error.message);
  process.exitCode = 1;
});
