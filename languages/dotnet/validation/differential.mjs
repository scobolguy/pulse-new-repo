import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify, isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CASES as csharpCases } from '../../csharp/validation/cases.mjs';
import { CASES as vbCases } from '../../vbish/validation/cases.mjs';
import { compileCsharpToPcode } from '../../csharp/src/compile-csharp-to-pcode.mjs';
import { compileVb11ToPcode } from '../../vbish/src/compile-vb11.mjs';
import { executeProgram, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/index.mjs';
import { sharedCompilerFiles } from './shared-files.mjs';
import { evaluate } from './evaluate.mjs';

const run = promisify(execFile);
const hash = value => createHash('sha256').update(value).digest('hex');
const limits = { timeout: 120000, maxBuffer: 2 * 1024 * 1024, windowsHide: true };
const latest = values => values.sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).at(-1);

async function findSdk() {
  const { stdout } = await run('dotnet', ['--list-sdks'], limits);
  const sdks = [...stdout.matchAll(/^(\d+\.\d+\.\d+)\s+\[(.+)\]\s*$/gm)];
  if (!sdks.length) throw new Error('An installed .NET SDK is required for differential validation.');
  const version = latest(sdks.map(match => match[1]));
  const sdkRoot = sdks.find(match => match[1] === version)[2];
  const referenceRoot = path.join(path.dirname(sdkRoot), 'packs', 'Microsoft.NETCore.App.Ref');
  const referenceVersion = latest((await fs.readdir(referenceRoot)).filter(value => /^\d+\.\d+\.\d+$/.test(value)));
  if (!referenceVersion) throw new Error('No installed .NET reference pack found.');
  const referenceBase = path.join(referenceRoot, referenceVersion, 'ref');
  const tfm = latest((await fs.readdir(referenceBase)).filter(value => /^net\d+\.\d+$/.test(value)));
  if (!tfm) throw new Error('No .NET target framework reference directory found.');
  const referencePath = path.join(referenceBase, tfm);
  const references = (await fs.readdir(referencePath)).filter(file => file.endsWith('.dll')).sort()
    .map(file => path.join(referencePath, file));
  return { version, compilerRoot: path.join(sdkRoot, version, 'Roslyn', 'bincore'),
    referenceVersion, referencePath, references, tfm };
}

async function pulseObservation(compile, item) {
  let artifact;
  try { artifact = compile(item.source, { fileName: item.id }); }
  catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return { stage: 'compile-error', errorName: error.name, diagnostic: error.message };
  }
  try {
    const result = await executeProgram({
      instructions: parsePcode(artifact.pcodeText), programMap: artifact.programMap,
      inputQueue: '', sourceMessage: '', runtimeContext: { maxSteps: 100000, maxCallDepth: 64 },
    });
    return { stage: 'executed', result, procedures: artifact.programMap.procedures };
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return { stage: 'runtime-error', errorName: error.name, diagnostic: error.message };
  }
}

async function referenceObservation(sdk, directory, language, item) {
  const source = path.join(directory, `${item.id}.${language === 'csharp' ? 'cs' : 'vb'}`);
  const output = path.join(directory, `${item.id}.dll`);
  const compiler = path.join(sdk.compilerRoot, language === 'csharp' ? 'csc.dll' : 'vbc.dll');
  const responseFile = path.join(directory, `${item.id}.rsp`);
  const options = ['-nologo', '-nostdlib', '-target:exe',
    `-out:"${output}"`, `-langversion:${language === 'csharp' ? '7.0' : '11'}`,
    ...sdk.references.map(reference => `-r:"${reference}"`),
    ...(language === 'vbish' ? [`-vbruntime:"${path.join(sdk.referencePath, 'Microsoft.VisualBasic.dll')}"`,
      '-optionstrict+', '-define:_MYTYPE=\\"Empty\\"'] : []),
    `"${source}"`];
  await fs.writeFile(source, item.source);
  await fs.writeFile(responseFile, options.join('\n'));
  try { await run('dotnet', [compiler, '-noconfig', `@${responseFile}`], limits); }
  catch (error) {
    const diagnostic = [error.stdout, error.stderr].filter(Boolean).join('\n');
    const errors = diagnostic.split(/\r?\n/).filter(line => /\berror (?:CS|BC)\d+\s*:/.test(line));
    if (error.code !== 1 || !errors.length || errors.some(line =>
      !line.includes(path.basename(source) + '(') || !/\(\d+(?:,\d+)?\)\s*:\s*error (?:CS|BC)\d+\s*:/.test(line))) throw error;
    return { stage: 'compile-error', diagnostic };
  }
  await fs.writeFile(path.join(directory, `${item.id}.runtimeconfig.json`), JSON.stringify({
    runtimeOptions: { tfm: sdk.tfm, framework: {
      name: 'Microsoft.NETCore.App', version: `${sdk.referenceVersion.split('.')[0]}.0.0`,
    }, rollForward: 'LatestMinor' },
  }));
  try {
    const { stdout } = await run('dotnet', [output], limits);
    const normalized = stdout.replace(/\r\n/g, '\n');
    return { stage: 'executed', stdout: normalized === '' ? [] : normalized.replace(/\n$/, '').split('\n') };
  } catch (error) {
    const diagnostic = String(error.stderr || '');
    if (error.killed || error.signal || typeof error.code !== 'number' || error.code === 0
      || !/^Unhandled exception\. System\.(?:Overflow|DivideByZero)Exception:/m.test(diagnostic)) throw error;
    return { stage: 'runtime-error', diagnostic };
  }
}

export async function runDifferential(suite = 'overloads') {
  if (!['overloads', 'numeric', 'integers'].includes(suite)) throw new Error(`Unknown differential suite '${suite}'`);
  const sdk = await findSdk();
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), `pulse-${suite}-differential-`));
  const languages = [
    { language: 'csharp', cases: csharpCases, compile: compileCsharpToPcode,
      localFiles: ['src/parser.mjs', 'grammar/Csharp.g4', 'grammar/generated/CsharpLexer.js', 'grammar/generated/CsharpParser.js'] },
    { language: 'vbish', cases: vbCases, compile: compileVb11ToPcode,
      localFiles: ['src/compile-vb11.mjs', 'grammar/Vbish.g4', 'grammar/generated/VbishLexer.js', 'grammar/generated/VbishParser.js'] },
  ];
  const report = {
    suite: `Shared scalar ${suite} differential validation`, complete: false,
    fullStandardConformance: false, startedAt: new Date().toISOString(),
    limits: { jobs: 4, processTimeoutMs: limits.timeout, maxSteps: 100000, maxCallDepth: 64 },
    reference: { sdk: sdk.version, referencePack: sdk.referenceVersion, csharpLanguage: '7.0', vbLanguage: '11',
      compilerHashes: Object.fromEntries(await Promise.all(['csc.dll', 'vbc.dll'].map(async name =>
        [name, hash(await fs.readFile(path.join(sdk.compilerRoot, name)))]))) },
    harnessFingerprint: hash(await fs.readFile(fileURLToPath(import.meta.url))), cases: [],
  };
  try {
    for (const language of languages) {
      const selected = language.cases.filter(item =>
        (['numeric', 'integers'].includes(suite) ? item.feature === suite : item.suite === suite) && item.kind !== 'unsupported');
      const files = [...sharedCompilerFiles, ...language.localFiles.map(file => new URL(`../../${language.language}/${file}`, import.meta.url))];
      const compilerFingerprint = hash(Buffer.concat(await Promise.all(files.map(file => fs.readFile(file)))));
      const compare = async item => {
        const pulse = await pulseObservation(language.compile, item);
        const reference = await referenceObservation(sdk, directory, language.language, item);
        const evaluated = evaluate(item, pulse);
        const agrees = item.kind === 'positive'
          ? reference.stage === 'executed' && isDeepStrictEqual(reference.stdout, item.stdout)
          : item.kind === 'runtime-error'
            ? reference.stage === 'runtime-error' && new RegExp(item.diagnostic).test(reference.diagnostic)
            : reference.stage === 'compile-error';
        const entry = {
          language: language.language, id: item.id, sourceSha256: hash(item.source), compilerFingerprint,
          expected: { kind: item.kind, stdout: item.stdout, diagnostic: item.diagnostic },
          pulse: { stage: pulse.stage, stdout: pulse.result?.stdout, diagnostic: pulse.diagnostic, errorName: pulse.errorName },
          reference, status: evaluated.status === 'pass' && agrees ? 'pass' : 'fail',
          ...(evaluated.status !== 'pass' ? { reason: evaluated.reason } : {}),
        };
        console.log(`${entry.status.toUpperCase()} ${entry.id} (Pulse / .NET SDK ${sdk.version})`);
        return entry;
      };
      for (let index = 0; index < selected.length; index += 4) {
        const batch = await Promise.allSettled(selected.slice(index, index + 4).map(compare));
        const failure = batch.find(result => result.status === 'rejected');
        if (failure) throw failure.reason;
        report.cases.push(...batch.map(result => result.value));
      }
    }
    report.complete = true;
    report.finishedAt = new Date().toISOString();
    report.counts = { pass: report.cases.filter(item => item.status === 'pass').length,
      fail: report.cases.filter(item => item.status === 'fail').length };
    const file = new URL(`../reports/${suite === 'overloads' ? 'overload' : suite}-differential.json`, import.meta.url);
    await fs.mkdir(new URL('../reports/', import.meta.url), { recursive: true });
    const temporary = fileURLToPath(file) + '.tmp';
    await fs.writeFile(temporary, JSON.stringify(report, null, 2) + '\n');
    await fs.rename(temporary, file);
    console.log(JSON.stringify({ report: fileURLToPath(file), ...report.counts }));
    return report;
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const valid = !args.length || args.length === 2 && args[0] === '--suite';
  Promise.resolve().then(() => {
    if (!valid) throw new Error('Usage: differential.mjs [--suite overloads|numeric|integers]');
    return runDifferential(args[1]);
  }).then(report => { process.exitCode = report.counts.fail ? 1 : 0; })
    .catch(error => { console.error(`[Differential validation] ${error.stack || error}`); process.exitCode = 2; });
}
