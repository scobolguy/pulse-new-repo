import fs from 'fs/promises';
import path from 'path';

const workspaceRoot = path.resolve(process.cwd(), '..');
const manifestPath = path.join(workspaceRoot, 'pcode', 'pcode-opcodes.manifest.json');
const pmachineHeaderPath = path.join(workspaceRoot, 'src', 'pmachine.h');
const pmachineSourcePath = path.join(workspaceRoot, 'src', 'pmachine.cpp');

function parseHexToNumber(hexText) {
  const s = String(hexText || '').trim();
  return Number.parseInt(s, 16);
}

function isCppTargetedOpcode(op) {
  const targets = Array.isArray(op?.targets)
    ? op.targets.map(t => String(t).toLowerCase())
    : null;

  if (!targets || targets.length === 0) return true;
  return targets.includes('cpp') || targets.includes('esp32') || targets.includes('shared');
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

function verifyCppExecutionSurface(manifestOps, headerText, sourceText) {
  const issues = [];
  const mnemonicOpcodes = new Set(
    [...headerText.matchAll(/return\s+(OP_[A-Z0-9_]+)\s*;/g)].map(match => match[1]),
  );
  const registeredHandlers = new Set(
    [...sourceText.matchAll(/handler_table\[(OP_[A-Z0-9_]+)\]/g)].map(match => match[1]),
  );
  const runStart = sourceText.indexOf('void PMachine::run(');
  const runEnd = sourceText.indexOf('bool PMachine::didLastRunHitStepLimit()', runStart);
  const runBody = runStart >= 0 && runEnd > runStart ? sourceText.slice(runStart, runEnd) : '';

  for (const op of manifestOps) {
    if (!mnemonicOpcodes.has(op.name)) {
      issues.push(`Missing mnemonic mapping in pmachine.h: ${op.name}`);
    }
    if (!registeredHandlers.has(op.name) && !runBody.includes(op.name)) {
      issues.push(`Missing runtime dispatch in pmachine.cpp: ${op.name}`);
    }
  }
  return issues;
}

async function main() {
  const manifestRaw = await fs.readFile(manifestPath, 'utf-8');
  const manifestJson = JSON.parse(manifestRaw);
  const manifestOps = (manifestJson.opcodes || [])
    .filter(isCppTargetedOpcode)
    .map(op => ({
    name: op.name,
    value: parseHexToNumber(op.hex)
    }));

  const headerRaw = await fs.readFile(pmachineHeaderPath, 'utf-8');
  const headerOps = parseCppOpcodeEnum(headerRaw);
  const sourceRaw = await fs.readFile(pmachineSourcePath, 'utf-8');

  const issues = [
    ...diffOpcodes(manifestOps, headerOps),
    ...verifyCppExecutionSurface(manifestOps, headerRaw, sourceRaw),
  ];
  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`[PCODE-COMPAT] ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`[PCODE-COMPAT] OK: ${manifestOps.length} opcodes match the ESP32 ABI, parser, and runtime dispatch`);
}

main().catch(err => {
  console.error('[PCODE-COMPAT] Failed:', err.message);
  process.exitCode = 1;
});
