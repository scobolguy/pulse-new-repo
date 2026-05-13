import fs from 'fs/promises';
import path from 'path';

const workspaceRoot = path.resolve(process.cwd(), '..');
const manifestPath = path.join(workspaceRoot, 'pcode', 'pcode-opcodes.manifest.json');
const pmachineHeaderPath = path.join(workspaceRoot, 'src', 'pmachine.h');

function parseHexToNumber(hexText) {
  const s = String(hexText || '').trim();
  return Number.parseInt(s, 16);
}

function parseCppOpcodeEnum(headerText) {
  const enumMatch = headerText.match(/enum\s+Opcode\s*:\s*uint8_t\s*\{([\s\S]*?)\};/m);
  if (!enumMatch) {
    throw new Error('Unable to locate enum Opcode in src/pmachine.h');
  }

  const body = enumMatch[1];
  const entries = [];
  const re = /(OP_[A-Z0-9_]+)\s*=\s*(0x[0-9A-Fa-f]+)/g;
  for (const m of body.matchAll(re)) {
    entries.push({ name: m[1], value: parseHexToNumber(m[2]) });
  }
  return entries;
}

function diffOpcodes(manifestOps, headerOps) {
  const issues = [];
  const manifestByName = new Map(manifestOps.map(op => [op.name, op.value]));
  const headerByName = new Map(headerOps.map(op => [op.name, op.value]));

  for (const [name, value] of manifestByName.entries()) {
    if (!headerByName.has(name)) {
      issues.push(`Missing in pmachine.h: ${name}`);
      continue;
    }
    const actual = headerByName.get(name);
    if (actual !== value) {
      issues.push(`Opcode mismatch for ${name}: manifest=0x${value.toString(16).toUpperCase()} header=0x${actual.toString(16).toUpperCase()}`);
    }
  }

  for (const [name] of headerByName.entries()) {
    if (!manifestByName.has(name)) {
      issues.push(`Missing in manifest: ${name}`);
    }
  }

  return issues;
}

async function main() {
  const manifestRaw = await fs.readFile(manifestPath, 'utf-8');
  const manifestJson = JSON.parse(manifestRaw);
  const manifestOps = (manifestJson.opcodes || []).map(op => ({
    name: op.name,
    value: parseHexToNumber(op.hex)
  }));

  const headerRaw = await fs.readFile(pmachineHeaderPath, 'utf-8');
  const headerOps = parseCppOpcodeEnum(headerRaw);

  const issues = diffOpcodes(manifestOps, headerOps);
  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`[PCODE-COMPAT] ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`[PCODE-COMPAT] OK: ${manifestOps.length} opcodes match between manifest and src/pmachine.h`);
}

main().catch(err => {
  console.error('[PCODE-COMPAT] Failed:', err.message);
  process.exitCode = 1;
});
