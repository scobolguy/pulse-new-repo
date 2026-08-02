import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { chromium } from 'playwright';

const html = fs.readFileSync(new URL('../public/bob-console.html', import.meta.url), 'utf8');
let pendingCount = 2;

const server = http.createServer((request, response) => {
  if (request.url === '/bob-console.html') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html);
    return;
  }
  if (request.url === '/api/agent/corrections' && request.method === 'GET') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ pendingCount, pending: [] }));
    return;
  }
  if (request.url === '/api/agent/corrections/run' && request.method === 'POST') {
    const appliedCount = pendingCount;
    pendingCount = 0;
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, appliedCount, pendingCount }));
    return;
  }
  response.writeHead(404);
  response.end();
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/bob-console.html`);
  const button = page.locator('#correctionsBtn');

  await assert.doesNotReject(() => button.waitFor({ state: 'visible' }));
  await page.waitForFunction(() => document.getElementById('correctionsBtn')?.textContent === 'Run Corrections (2)');
  assert.equal(await button.isEnabled(), true);
  assert.equal(await button.evaluate(element => element.classList.contains('pending')), true);

  await button.click();
  await page.waitForFunction(() => document.getElementById('correctionsBtn')?.textContent === 'Run Corrections (0)');
  assert.equal(await button.isDisabled(), true);
  assert.match(await page.locator('#outputPane').innerText(), /Applied 2 NLI corrections/);

  console.log('[bob-corrections-button] PASS: count, active state, run action, and disabled state');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}