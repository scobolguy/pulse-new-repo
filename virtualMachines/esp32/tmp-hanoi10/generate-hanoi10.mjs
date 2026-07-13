import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const n = Math.max(1, Number.parseInt(process.argv[2] || '10', 10) || 10);
const outDir = path.resolve(process.cwd(), `tmp-hanoi${n}`);
const pcodePath = path.join(outDir, `hanoi${n}.pcode`);
const mapPath = path.join(outDir, `hanoi${n}.program.json`);
const templatePcodePath = path.resolve(process.cwd(), 'pcode', 'towers-of-hanoi.pcode');
const templateMapPath = path.resolve(process.cwd(), 'pcode', 'towers-of-hanoi.program.json');

const templatePcode = await fs.readFile(templatePcodePath, 'utf8');
const pcodeText = templatePcode.replace('PUSH_INT 3\nSTORE diskCount', `PUSH_INT ${n}\nSTORE diskCount`);
if (pcodeText === templatePcode) {
  throw new Error(`Unable to patch Towers of Hanoi disk count to ${n}`);
}

const templateMap = JSON.parse(await fs.readFile(templateMapPath, 'utf8'));
const programMap = {
  ...templateMap,
  generatedAt: new Date().toISOString(),
  nodeId: `compute-hanoi-n${n}`,
  nodeLabel: `hanoi${n}`,
  operationRef: 'towers-of-hanoi',
  instructionCount: pcodeText.trimEnd().split(/\r?\n/).length,
  summaryLine: `Towers of Hanoi n=${n} (${(2 ** n) - 1} moves)`,
};

const key = 'dev-insecure-key-change-me';
const signature = crypto.createHmac('sha256', key).update(pcodeText, 'utf8').digest('hex');
programMap.signing = {
  algorithm: 'hmac-sha256',
  keyId: 'profile-default',
  signature,
  signedAt: new Date().toISOString(),
  pcodeLength: pcodeText.length,
  canonicalForm: 'raw-pcode-text-v1',
};

await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(pcodePath, pcodeText, 'utf8');
await fs.writeFile(mapPath, `${JSON.stringify(programMap, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ pcodePath, mapPath, instructionCount: programMap.instructionCount }, null, 2));
