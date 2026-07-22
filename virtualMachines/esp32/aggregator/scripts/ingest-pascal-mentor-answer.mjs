import fs from 'fs/promises';
import path from 'path';
import crypto from 'node:crypto';
import { compileStandardPascalWithAntlr } from './compile-standard-pascal-antlr-to-pcode.mjs';

const WORKDIR = process.cwd();
const GOLDENS_PATH = path.resolve(WORKDIR, 'data', 'pascal-ollama-goldens.json');
const SESSIONS_DIR = path.resolve(WORKDIR, 'data', 'ollama-mentor-sessions');

function parseArgs(argv) {
  const args = {
    packet: '',
    answer: '',
    prompt: ''
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--packet') args.packet = path.resolve(String(argv[i + 1] || ''));
    if (token === '--answer') args.answer = path.resolve(String(argv[i + 1] || ''));
    if (token === '--prompt') args.prompt = String(argv[i + 1] || '');
  }

  if (!args.answer) throw new Error('Missing required --answer argument');
  if (!args.packet && !args.prompt.trim()) {
    throw new Error('Provide either --packet or --prompt');
  }
  return args;
}

async function loadJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function loadGoldens() {
  try {
    return await loadJson(GOLDENS_PATH);
  } catch {
    return { version: 1, description: 'Few-shot Pascal prompt examples for local Ollama DSL coaching.', examples: [] };
  }
}

function makeExampleId(prompt, response) {
  const hash = crypto.createHash('sha256').update(`${prompt}\n---\n${response}`).digest('hex').slice(0, 12);
  return `accepted-${hash}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const answerText = (await fs.readFile(args.answer, 'utf-8')).trim();
  if (!answerText) throw new Error('Answer file is empty');

  compileStandardPascalWithAntlr(answerText);

  let prompt = args.prompt.trim();
  let sessionId = null;
  let packetPath = null;
  if (args.packet) {
    const packet = await loadJson(args.packet);
    prompt = String(packet?.prompt || '').trim();
    sessionId = String(packet?.sessionId || '').trim() || null;
    packetPath = args.packet;
  }

  if (!prompt) throw new Error('Prompt could not be resolved');

  const goldens = await loadGoldens();
  const examples = Array.isArray(goldens.examples) ? goldens.examples : [];
  const duplicate = examples.find((entry) => String(entry.prompt || '').trim() === prompt && String(entry.response || '').trim() === answerText);
  const exampleId = duplicate?.id || makeExampleId(prompt, answerText);

  if (!duplicate) {
    examples.push({
      id: exampleId,
      prompt,
      response: answerText,
      source: 'accepted-mentor-answer'
    });
    goldens.examples = examples;
    await fs.writeFile(GOLDENS_PATH, `${JSON.stringify(goldens, null, 2)}\n`, 'utf-8');
  }

  if (sessionId) {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
    const sessionPath = path.resolve(SESSIONS_DIR, `${sessionId}.resolved.json`);
    await fs.writeFile(sessionPath, `${JSON.stringify({
      sessionId,
      status: 'resolved-by-copilot',
      resolvedAt: new Date().toISOString(),
      prompt,
      answerPath: path.relative(WORKDIR, args.answer).replace(/\\/g, '/'),
      packetPath: packetPath ? path.relative(WORKDIR, packetPath).replace(/\\/g, '/') : null,
      goldenExampleId: exampleId
    }, null, 2)}\n`, 'utf-8');
  }

  console.log(JSON.stringify({
    status: 'ok',
    prompt,
    answerPath: path.relative(WORKDIR, args.answer).replace(/\\/g, '/'),
    goldenExampleId: exampleId,
    duplicate: Boolean(duplicate)
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
