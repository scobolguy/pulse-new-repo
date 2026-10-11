import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { createGitHubIssuesClient, toBoardIssue } from '../../aggregator/src/backend/githubIssues.mjs';
import { registerIssueRoutes } from '../../aggregator/src/backend/issueRoutes.mjs';
import { createRouteManifestDependencyFactories } from '../../aggregator/src/backend/modules/routeManifestDependencies.mjs';
const require = createRequire(new URL('../../aggregator/package.json', import.meta.url));
const express = require('express');

const issue = (number = 1, extra = {}) => ({
  number, title: 'Regression', labels: [{ name: 'area:regressions' }],
  state: 'open', updated_at: '2026-10-01T12:00:00Z', assignees: [{ login: 'tester' }], ...extra,
});
const response = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers });

test('issue route factory supplies the backend session and permission dependencies', () => {
  const deps = {
    getSessionUserIdFromRequest: () => 'tester',
    resolveEffectiveAccessForUser: () => ({ permissions: ['governance.read'] }),
    hasPermission: (permissions, permission) => permissions.includes(permission),
  };
  const factories = createRouteManifestDependencyFactories(deps);
  assert.deepEqual(factories.issues(), deps);
});

test('board maps default and conflicting statuses without hiding closed issues', () => {
  assert.equal(toBoardIssue(issue()).status, 'backlog');
  assert.equal(toBoardIssue(issue(1, { state: 'closed' })).status, 'done');
  assert.equal(toBoardIssue(issue(1, { labels: ['status:blocked', 'status:backlog'] })).conflict, true);
  assert.equal(toBoardIssue(issue(1, { labels: ['status:done'] })).conflict, true);
  assert.equal(toBoardIssue(issue(1, { state: 'closed', labels: ['status:blocked'] })).conflict, true);
  assert.deepEqual(toBoardIssue(issue()).assignees, ['tester']);
});

test('GitHub list reads every page, excludes PRs and deduplicates shifting pages', async () => {
  const calls = [];
  const first = Array.from({ length: 100 }, (_, index) => issue(index + 1));
  first[0].pull_request = {};
  const client = createGitHubIssuesClient({ token: 'test-only', fetchImpl: async (url, options) => {
    calls.push(url);
    assert.equal(options.redirect, 'error');
    assert.match(url, /^https:\/\/api.github.com\/repos\/scobolguy\/pulse-new-repo\//);
    return response(calls.length === 1 ? first : [issue(100), issue(101, { state: 'closed' })]);
  } });
  const items = await client.list();
  assert.equal(calls.length, 2);
  assert.match(calls[1], /page=2/);
  assert.equal(items.length, 100);
  assert.ok(!items.some(item => item.number === 1));
  assert.equal(items.find(item => item.number === 101).status, 'done');
});

test('creation and moves provision labels and preserve unrelated labels while closing and reopening', async () => {
  let current = issue();
  const patches = [];
  const client = createGitHubIssuesClient({ token: 'test-only', fetchImpl: async (url, options) => {
    if (url.includes('/labels/')) return response({ name: 'existing' });
    if (options.method === 'POST') {
      const body = JSON.parse(options.body);
      assert.deepEqual(body.labels, ['status:backlog']);
      return response(issue(2, body), 201);
    }
    if (options.method === 'PATCH') {
      const body = JSON.parse(options.body);
      patches.push(body);
      current = { ...current, ...body };
      return response(current);
    }
    return response(current);
  } });
  assert.equal((await client.create({ title: 'New', body: 'Reproduction' })).number, 2);
  const closed = await client.move(1, 'done', toBoardIssue(current).version);
  assert.deepEqual(patches[0], { state: 'closed', labels: ['area:regressions', 'status:done'] });
  const reopened = await client.move(1, 'in-progress', closed.version);
  assert.equal(reopened.status, 'in-progress');
  assert.deepEqual(patches[1], { state: 'open', labels: ['area:regressions', 'status:in-progress'] });
});

test('stale moves and pull requests are rejected before writes', async () => {
  for (const [data, code] of [[issue(), 'STALE_ISSUE'], [issue(1, { pull_request: {} }), 'NOT_AN_ISSUE']]) {
    let calls = 0;
    const client = createGitHubIssuesClient({ token: 'test-only', fetchImpl: async () => { calls++; return response(data); } });
    await assert.rejects(client.move(1, 'done', 'old'), error => error.code === code);
    assert.equal(calls, 1);
  }
});

test('missing configuration, rate limits, malformed lists, transport and write failures are explicit', async () => {
  await assert.rejects(createGitHubIssuesClient({ token: '' }).list(), error => error.code === 'GITHUB_NOT_CONFIGURED');
  for (const [status, headers, code] of [
    [401, {}, 'GITHUB_AUTH_FAILED'], [403, {}, 'GITHUB_ACCESS_DENIED'],
    [403, { 'x-ratelimit-remaining': '0' }, 'GITHUB_RATE_LIMIT'],
    [429, {}, 'GITHUB_RATE_LIMIT'], [500, {}, 'GITHUB_REQUEST_FAILED'],
  ]) {
    const client = createGitHubIssuesClient({ token: 'test-only', fetchImpl: async () => response({}, status, headers) });
    await assert.rejects(client.list(), error => error.code === code);
  }
  await assert.rejects(createGitHubIssuesClient({ token: 'test-only', fetchImpl: async () => response({}) }).list(), /invalid issue list/);
  await assert.rejects(createGitHubIssuesClient({ token: 'test-only', fetchImpl: async () => { throw new Error('private details'); } }).list(), /could not be reached/);
  const client = createGitHubIssuesClient({ token: 'test-only', fetchImpl: async (_url, options) =>
    options.method === 'PATCH' ? response({}, 500) : response(issue()) });
  await assert.rejects(client.move(1, 'done', toBoardIssue(issue()).version), error => error.code === 'GITHUB_REQUEST_FAILED');
});

test('HTTP routes require real sessions, deny unauthorized writes and validate inputs', async t => {
  const app = express();
  app.use(express.json());
  let writes = 0;
  const logged = [];
  registerIssueRoutes(app, {
    getSessionUserIdFromRequest: req => req.get('authorization') === 'Bearer test-session' ? 'tester' : '',
    resolveEffectiveAccessForUser: () => ({ user: { enabled: true }, permissions: ['governance.read'] }),
    hasPermission: (permissions, permission) => permissions.includes(permission),
    logError: (...args) => logged.push(args),
    client: { list: async () => [], create: async () => { writes++; } },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/issues`;
  assert.equal((await fetch(url, { headers: { 'x-user-id': 'system-admin' } })).status, 401);
  assert.equal((await fetch(url, { headers: { authorization: 'Bearer test-session' } })).status, 200);
  assert.equal((await fetch(url, { method: 'POST', headers: { authorization: 'Bearer test-session', 'Content-Type': 'application/json' }, body: '{"title":"No"}' })).status, 403);
  assert.equal(writes, 0);
});

test('authorized routes reject invalid payloads and surface partial upstream failure', async t => {
  const app = express();
  app.use(express.json());
  const client = createGitHubIssuesClient({ token: 'test-only', fetchImpl: async () => response({}, 500) });
  registerIssueRoutes(app, {
    getSessionUserIdFromRequest: () => 'tester',
    resolveEffectiveAccessForUser: () => ({ user: { enabled: true }, permissions: ['*'] }),
    hasPermission: () => true,
    logError: () => {},
    client,
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/issues`;
  const send = (url, method, body) => fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await send(base, 'POST', { title: '' })).status, 400);
  assert.equal((await send(`${base}/1/status`, 'PATCH', { status: 'unknown', version: 'old' })).status, 400);
  assert.equal((await send(`${base}/-1/status`, 'PATCH', { status: 'done', version: 'old' })).status, 400);
  const failed = await send(base, 'POST', { title: 'Valid' });
  assert.equal(failed.status, 502);
  assert.equal((await failed.json()).code, 'GITHUB_REQUEST_FAILED');
});
