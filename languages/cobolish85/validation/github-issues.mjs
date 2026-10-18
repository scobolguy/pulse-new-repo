import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const repository = 'scobolguy/pulse-new-repo';

function authentication() {
  if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) return process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const credential = execFileSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8', timeout: 30000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  const password = credential.split(/\r?\n/).find(line => line.startsWith('password='))?.slice(9);
  if (!password) throw new Error('No GitHub credential available; configure authenticated GitHub access.');
  return password;
}

export async function githubClient() {
  const token = authentication();
  return async function request(route, method = 'GET', body) {
    const response = await fetch(`https://api.github.com${route}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error(`GitHub ${method} ${route}: HTTP ${response.status}`);
    return response.json();
  };
}

async function main() {
  const request = await githubClient();
  const repo = await request(`/repos/${repository}`);
  if (!repo.has_issues || !(repo.permissions?.push || repo.permissions?.triage || repo.permissions?.admin)) {
    throw new Error('Repository issue write permission is not verified.');
  }
  if (process.argv.includes('--check')) {
    console.log(`[GitHub] Issue write access verified for ${repository}`);
    return;
  }
  const resultsPath = process.argv[2];
  if (!resultsPath) throw new Error('Usage: node validation/github-issues.mjs results.json [--publish]');
  const results = JSON.parse(await fs.readFile(resultsPath, 'utf8'));
  if (!process.argv.includes('--publish')) throw new Error('Pass --publish to create/update GitHub issues.');
  const mappingPath = path.join(path.dirname(resultsPath), 'issues.json');
  const mapping = {};
  for (let page = 1; ; page++) {
    const issues = await request(`/repos/${repository}/issues?state=all&per_page=100&page=${page}`);
    for (const issue of issues) {
      const id = issue.body?.match(/<!-- pulse-ccvs:([A-Z0-9-]+) -->/)?.[1];
      if (id) {
        if (mapping[id]) throw new Error(`Duplicate CCVS issues already exist for ${id}`);
        mapping[id] = { number: issue.number, url: issue.html_url, state: issue.state };
      }
    }
    if (issues.length < 100) break;
  }
  for (const result of results.programs) {
    if (result.outcome === 'pass' || result.role === 'harness') continue;
    const marker = `<!-- pulse-ccvs:${result.id} -->`;
    const body = `${marker}\n## COBOLish85 CCVS baseline: ${result.id}\n\n`
      + `Module: ${result.module}; role: ${result.role}; outcome: **${result.outcome}**.\n\n`
      + `Corpus SHA-256: \`${results.corpus.sha256}\`\nCompiler fingerprint: \`${results.compilerFingerprint}\`\n\n`
      + 'Reproduce from `languages/cobolish85`:\n```text\n'
      + `npm run validate:ccvs -- --corpus <path-to-newcob.val> --program ${result.id} --out validation/runs/${result.id}\n\`\`\`\n\n`
      + 'Expected: compile successfully and meet this CCVS program’s documented execution/report requirements.\n\n'
      + `Actual:\n\`\`\`text\n${String(result.diagnostic || result.outcome).slice(0, 8000).replace(/```/g, "'''")}\n\`\`\`\n\n`
      + 'This baseline failure is not a compatibility pass. Missing language facilities are tracked, not implemented in this ISAM-focused effort. '
      + 'Root cause is unverified unless the diagnostic establishes it; individual test results are unavailable when compilation fails.\n';
    const existing = mapping[result.id];
    const issue = existing
      ? await request(`/repos/${repository}/issues/${existing.number}`, 'PATCH', { body, state: 'open' })
      : await request(`/repos/${repository}/issues`, 'POST', { title: `[CCVS85] ${result.id}: ${result.outcome}`, body });
    mapping[result.id] = { number: issue.number, url: issue.html_url, state: issue.state };
    await fs.writeFile(mappingPath, `${JSON.stringify(mapping, null, 2)}\n`);
    console.log(`[GitHub] ${result.id}: #${issue.number}`);
    await new Promise(resolve => setTimeout(resolve, 3500));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
