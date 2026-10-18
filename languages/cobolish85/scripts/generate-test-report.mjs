// Runs the COBOL85 test files, collects the program/expected/actual records the
// tests write through tests/support/trace.mjs, and renders one page per test
// followed by a summary page (HTML, plus PDF when Edge or Chrome is available).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { run } from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const testsDir = path.join(root, 'tests');
const defaultFiles = () => fs.readdirSync(testsDir)
  .filter(name => name.endsWith('.test.mjs') || name.endsWith('-suite.mjs'))
  .sort()
  .map(name => path.join(testsDir, name));

function parseArguments(argv) {
  const options = { out: path.join(root, 'reports'), files: [], pdf: true };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--out') options.out = path.resolve(argv[++index]);
    else if (argument === '--no-pdf') options.pdf = false;
    else if (argument.startsWith('--')) throw new Error(`Unknown argument ${argument}`);
    else options.files.push(path.resolve(argument));
  }
  if (!options.files.length) options.files = defaultFiles();
  return options;
}

async function runTests(files, traceFile) {
  process.env.COBOL85_TEST_TRACE = traceFile;
  // One run() per file: test() is wrapped in tests/support/trace.mjs, so the location node
  // reports for an event is the wrapper, not the test file. Each stream identifies its file.
  const perFile = await Promise.all(files.map(file => runFile(path.resolve(file))));
  return perFile.flat();
}

async function runFile(file) {
  const results = [];
  const stream = run({ files: [file], timeout: 600000 });
  stream.on('test:stdout', () => {});
  stream.on('test:stderr', () => {});
  for await (const event of stream) {
    if (event.type !== 'test:pass' && event.type !== 'test:fail') continue;
    const { data } = event;
    if (data.details?.type === 'suite' || data.nesting > 0) continue;
    const error = data.details?.error;
    const cause = error?.cause ?? error;
    results.push({
      file,
      name: data.name,
      status: data.skip ? 'skipped' : data.todo ? 'todo' : event.type === 'test:pass' ? 'pass' : 'fail',
      durationMs: data.details?.duration_ms ?? 0,
      error: event.type === 'test:fail' ? String(cause?.message ?? cause ?? 'failed') : null
    });
  }
  return results;
}

function readTrace(traceFile) {
  if (!fs.existsSync(traceFile)) return [];
  return fs.readFileSync(traceFile, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
}

function attachTrace(results, records) {
  const byKey = new Map(results.map(result => [`${result.file}\u0000${result.name}`, result]));
  for (const result of results) Object.assign(result, { programs: [], checks: [] });
  for (const record of records) {
    let target = byKey.get(`${record.file}\u0000${record.test}`);
    // Files that run top-level code (no test() wrapper) report as one file-level test.
    if (!target) target = results.find(result => result.file === record.file && record.test === null);
    if (!target) continue;
    if (record.kind === 'program') {
      if (!target.programs.some(program => program.source === record.source)) target.programs.push(record);
    } else {
      target.checks.push(record);
    }
  }
}

const escapeHtml = value => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function show(value) {
  if (value === undefined) return '(none recorded)';
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
    return value.length ? value.join('\n') : '(no output)';
  }
  return JSON.stringify(value, null, 2);
}

function checkMatched(check) {
  return check.matched ?? isDeepStrictEqual(check.expected, check.actual);
}

const relative = file => (file ? path.relative(root, file).replaceAll('\\', '/') : '(unknown file)');

function renderTestPage(result, index, total) {
  const programs = result.programs.length
    ? result.programs.map((program, programIndex) => {
      const meta = [program.category && `Category: ${program.category}`,
        program.module && `CCVS module: ${program.module}`,
        program.ccvs && `Modeled on CCVS: ${[program.ccvs].flat().join(', ')}`,
        program.reference && `Manual reference: ${program.reference}`].filter(Boolean);
      return `${result.programs.length > 1 ? `<h3>Program ${programIndex + 1}</h3>` : ''}
        ${meta.length ? `<p class="meta">${meta.map(escapeHtml).join(' &middot; ')}</p>` : ''}
        <pre class="program">${escapeHtml(program.source)}</pre>`;
    }).join('\n')
    : '<p class="none">This test does not compile a COBOL program; it checks harness or tooling behavior.</p>';
  const checks = result.checks.length
    ? result.checks.map(check => {
      const ok = checkMatched(check);
      return `<div class="check ${ok ? 'ok' : 'bad'}">
        <h4>${escapeHtml(check.description ?? 'Check')} <span>${ok ? 'MATCH' : 'MISMATCH'}</span></h4>
        <div class="columns">
          <div><h5>Expected result</h5><pre>${escapeHtml(show(check.expected))}</pre></div>
          <div><h5>Actual result</h5><pre>${escapeHtml(show(check.actual))}</pre></div>
        </div></div>`;
    }).join('\n')
    : `<div class="columns">
        <div><h5>Expected result</h5><pre>Test assertions pass</pre></div>
        <div><h5>Actual result</h5><pre>${escapeHtml(result.status === 'pass' ? 'Test assertions pass' : result.error)}</pre></div>
      </div>`;
  return `<section class="page">
    <header><span class="counter">Test ${index + 1} of ${total}</span>
      <span class="status ${result.status}">${result.status.toUpperCase()}</span></header>
    <h2>${escapeHtml(result.name)}</h2>
    <p class="meta">File: ${escapeHtml(relative(result.file))} &middot; Duration: ${result.durationMs.toFixed(1)} ms</p>
    <h3>Program</h3>${programs}
    <h3>Expected vs actual</h3>${checks}
    ${result.status === 'fail' ? `<h3>Failure</h3><pre class="failure">${escapeHtml(result.error)}</pre>` : ''}
  </section>`;
}

function renderSummary(results, startedAt, finishedAt) {
  const count = status => results.filter(result => result.status === status).length;
  const groupKey = result => result.programs[0]?.module ? `CCVS ${result.programs[0].module}`
    : result.programs[0]?.category ? `Nucleus: ${result.programs[0].category}` : relative(result.file);
  const groups = new Map();
  for (const result of results) {
    const key = groupKey(result);
    const group = groups.get(key) ?? { pass: 0, fail: 0, other: 0 };
    group[result.status === 'pass' ? 'pass' : result.status === 'fail' ? 'fail' : 'other'] += 1;
    groups.set(key, group);
  }
  const failures = results.map((result, index) => ({ result, index })).filter(({ result }) => result.status === 'fail');
  return `<section class="page summary">
    <h2>Summary</h2>
    <p class="meta">Started ${escapeHtml(startedAt)} &middot; finished ${escapeHtml(finishedAt)} &middot; Node ${process.version}</p>
    <table class="totals"><tr><th>Tests</th><th>Passed</th><th>Failed</th><th>Skipped / TODO</th><th>Pass rate</th></tr>
      <tr><td>${results.length}</td><td class="pass">${count('pass')}</td><td class="fail">${count('fail')}</td>
      <td>${count('skipped') + count('todo')}</td><td>${results.length ? ((100 * count('pass')) / results.length).toFixed(1) : '0.0'}%</td></tr></table>
    <h3>By group</h3>
    <table><tr><th>Group</th><th>Passed</th><th>Failed</th><th>Other</th></tr>
      ${[...groups].map(([key, group]) => `<tr><td>${escapeHtml(key)}</td><td>${group.pass}</td><td>${group.fail}</td><td>${group.other}</td></tr>`).join('\n')}
    </table>
    <h3>Failed tests (${failures.length})</h3>
    ${failures.length ? `<table><tr><th>Page</th><th>Test</th><th>Reason</th></tr>
      ${failures.map(({ result, index }) => `<tr><td>${index + 1}</td><td>${escapeHtml(result.name)}</td>
        <td>${escapeHtml(result.error.split('\n')[0].slice(0, 200))}</td></tr>`).join('\n')}</table>` : '<p>None.</p>'}
  </section>`;
}

const styles = `
  body { font-family: Segoe UI, Arial, sans-serif; font-size: 11px; color: #1b1b1b; margin: 0; }
  .page { padding: 18px 24px; page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 4px; }
  h1 { font-size: 20px; } h2 { font-size: 15px; margin: 8px 0 2px; } h3 { font-size: 12px; margin: 10px 0 4px; }
  h4 { font-size: 11px; margin: 6px 0; } h4 span { float: right; } h5 { margin: 2px 0; font-size: 10px; color: #555; }
  pre { background: #f6f6f6; border: 1px solid #ddd; padding: 6px; white-space: pre-wrap; word-break: break-word; margin: 0; font-size: 10px; }
  pre.program { font-family: Consolas, monospace; }
  .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .check { border-left: 4px solid; padding-left: 6px; margin-bottom: 6px; }
  .check.ok { border-color: #2e7d32; } .check.bad { border-color: #c62828; }
  .check.ok h4 span { color: #2e7d32; } .check.bad h4 span { color: #c62828; }
  .status { font-weight: bold; padding: 1px 8px; color: white; border-radius: 3px; }
  .status.pass { background: #2e7d32; } .status.fail { background: #c62828; } .status.skipped, .status.todo { background: #777; }
  .meta { color: #555; margin: 2px 0; } .none { font-style: italic; }
  pre.failure { border-color: #c62828; background: #fdecea; }
  table { border-collapse: collapse; margin-bottom: 8px; } td, th { border: 1px solid #ccc; padding: 3px 8px; text-align: left; }
  td.pass { color: #2e7d32; font-weight: bold; } td.fail { color: #c62828; font-weight: bold; }
  .cover { page-break-after: always; break-after: page; padding: 40px 24px; }
`;

function findBrowser() {
  const candidates = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'
  ];
  return candidates.find(candidate => fs.existsSync(candidate));
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  fs.mkdirSync(options.out, { recursive: true });
  const traceFile = path.join(os.tmpdir(), `cobol85-trace-${process.pid}-${Date.now()}.jsonl`);
  const startedAt = new Date().toISOString();
  let results;
  try {
    results = await runTests(options.files, traceFile);
    attachTrace(results, readTrace(traceFile));
  } finally {
    fs.rmSync(traceFile, { force: true });
  }
  const finishedAt = new Date().toISOString();
  const order = new Map(options.files.map((file, index) => [file, index]));
  results.sort((left, right) => (order.get(left.file) ?? 1e9) - (order.get(right.file) ?? 1e9));
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>COBOL85 test report</title><style>${styles}</style></head><body>
    <section class="cover"><h1>COBOLish85 / COBOL 85 test report</h1>
      <p>${results.length} tests from ${options.files.length} files. Each following page shows one test: the COBOL program,
      the expected result and the actual result. The final page is the summary.</p>
      <p class="meta">Generated ${escapeHtml(finishedAt)}</p></section>
    ${results.map((result, index) => renderTestPage(result, index, results.length)).join('\n')}
    ${renderSummary(results, startedAt, finishedAt)}
  </body></html>`;
  const htmlFile = path.join(options.out, 'cobol85-test-report.html');
  fs.writeFileSync(htmlFile, html);
  console.log(`[report] HTML: ${htmlFile}`);
  const browser = options.pdf && findBrowser();
  if (browser) {
    const pdfFile = path.join(options.out, 'cobol85-test-report.pdf');
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cobol85-report-browser-'));
    try {
      execFileSync(browser, ['--headless', '--disable-gpu', '--no-pdf-header-footer', `--user-data-dir=${profile}`,
        `--print-to-pdf=${pdfFile}`, pathToFileURL(htmlFile).href], { stdio: 'ignore', timeout: 300000 });
      console.log(`[report] PDF:  ${pdfFile}`);
    } catch (error) {
      console.warn(`[report] PDF generation failed: ${error.message}`);
    } finally {
      fs.rmSync(profile, { recursive: true, force: true });
    }
  } else if (options.pdf) {
    console.warn('[report] No Edge/Chrome found; open the HTML file and print it to PDF.');
  }
  const failed = results.filter(result => result.status === 'fail').length;
  console.log(`[report] ${results.length} tests, ${results.length - failed} passed, ${failed} failed`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
