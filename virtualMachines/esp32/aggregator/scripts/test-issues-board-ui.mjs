import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  let signedIn = false;
  let failMove = false;
  let cards = [];
  await page.route('**/api/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const payload = request.postDataJSON();
    const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (pathname === '/api/auth/login') {
      assert.deepEqual(payload, { userId: 'tester', password: 'test-password' });
      signedIn = true;
      return reply({ token: 'test-session', actor: { userId: 'tester' } });
    }
    if (!signedIn) return reply({ error: 'Sign in to Pulse to access GitHub issues.' }, 401);
    assert.equal(request.headers().authorization, 'Bearer test-session');
    if (request.method() === 'GET') return reply({ issues: cards });
    if (request.method() === 'POST') {
      const issue = { number: 42, title: payload.title, url: 'https://github.com/scobolguy/pulse-new-repo/issues/42',
        labels: ['status:backlog'], assignees: [], status: 'backlog', conflict: false, version: 'v1' };
      cards = [issue];
      return reply({ issue }, 201);
    }
    if (failMove) return reply({ error: 'GitHub rejected the request. Refresh before retrying a write.' }, 502);
    assert.equal(payload.version, cards[0].version);
    cards = [{ ...cards[0], status: payload.status, labels: [`status:${payload.status}`], version: `${cards[0].version}+` }];
    return reply({ issue: cards[0] });
  });
  await page.goto(process.env.ISSUES_BOARD_URL || 'http://127.0.0.1:5173/issues');
  await page.getByRole('alert').waitFor();
  await page.getByText('Sign in to Pulse / change account', { exact: true }).click();
  await page.getByLabel('User ID', { exact: true }).fill('tester');
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByText('No GitHub issues yet. Create the first issue above.').waitFor();
  await page.getByText('Create a GitHub issue', { exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('UI regression gate');
  await page.getByLabel('Description', { exact: true }).fill('Reproduction and acceptance checks');
  await page.getByRole('button', { name: 'Create issue', exact: true }).click();
  const status = page.getByLabel('Status for issue #42', { exact: true });
  await status.waitFor();
  await status.focus();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.getByRole('heading', { name: 'Done (1)', exact: true }).waitFor();
  await status.selectOption('in-progress');
  await page.getByRole('heading', { name: 'In Progress (1)', exact: true }).waitFor();
  failMove = true;
  await status.selectOption('blocked');
  await page.getByRole('alert').waitFor();
  assert.equal(await status.inputValue(), 'in-progress');
  assert.match(await page.getByRole('alert').innerText(), /refresh before retrying/i);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('.issues-columns').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length), 1);
  console.log('PASS issue board: authentication, empty state, creation, keyboard move, reopen, failed move, narrow layout.');
} finally {
  await browser.close();
}
