/**
 * Playwright smoke test for bob-console.html
 *
 * Run:  node scripts/test-bob-console-playwright.mjs [url]
 * Default URL: http://127.0.0.1:5173/bob-console.html
 *
 * Tests:
 *  1. Page loads and key elements are visible
 *  2. Status dot starts idle
 *  3. Type a query + Send → output pane updates with non-empty text
 *  4. Query via Enter key → output pane updates again
 *  5. Reset Model button → output pane shows reset confirmation
 *  6. File attach label is present and functional
 *  7. Screenshot saved to bob-console-test.png
 */

import { chromium } from 'playwright';

const CONSOLE_URL = process.argv[2] || 'http://127.0.0.1:5173/bob-console.html';
const SCREENSHOT   = 'bob-console-test.png';

function pass(msg) { console.log(`  PASS  ${msg}`); }
function fail(msg) { throw new Error(`FAIL: ${msg}`); }

async function waitForOutputChange(page, previousText, timeoutMs = 15000) {
  await page.waitForFunction(
    (prev) => {
      const el = document.getElementById('outputPane');
      if (!el) return false;
      const current = el.innerText || el.textContent || '';
      return current.trim() !== prev.trim() && current.trim() !== '';
    },
    previousText,
    { timeout: timeoutMs }
  );
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();
  const logs    = [];
  const netFail = [];

  page.on('console', (msg) => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('response', (res) => {
    if (!res.ok()) netFail.push(`${res.status()} ${res.url()}`);
  });

  try {
    // ── 1. Load page ────────────────────────────────────────────────────────
    console.log(`\nLoading ${CONSOLE_URL} ...`);
    await page.goto(CONSOLE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    pass('page loaded (domcontentloaded)');

    // ── 2. Key elements visible ──────────────────────────────────────────────
    await page.locator('#outputPane').waitFor({ timeout: 5000 });
    await page.locator('#queryBox').waitFor({ timeout: 5000 });
    await page.locator('#talkBtn').waitFor({ timeout: 5000 });
    await page.locator('#sendBtn').waitFor({ timeout: 5000 });
    await page.locator('#resetBtn').waitFor({ timeout: 5000 });
    await page.locator('#uploadLabel').waitFor({ timeout: 5000 });
    pass('all UI elements present (#outputPane, #queryBox, #talkBtn, #sendBtn, #resetBtn, #uploadLabel)');

    // ── 3. Status starts idle ────────────────────────────────────────────────
    const statusLabel = await page.locator('#statusLabel').innerText();
    if (statusLabel.trim() !== 'idle') fail(`Expected status "idle", got "${statusLabel}"`);
    pass(`status label is "idle"`);

    const dotClass = await page.locator('#statusDot').getAttribute('class');
    if (dotClass && dotClass.trim() !== '') fail(`Expected status dot class "", got "${dotClass}"`);
    pass('status dot has no active class (idle)');

    // ── 4. Type + Send → output updates ─────────────────────────────────────
    const before1 = await page.locator('#outputPane').innerText();
    await page.locator('#queryBox').fill('how many nodes');
    await page.locator('#sendBtn').click();
    console.log('  Waiting for MCP response (query: "how many nodes")...');
    await waitForOutputChange(page, before1, 15000);
    const output1 = await page.locator('#outputPane').innerText();
    if (!output1.trim()) fail('Output pane is empty after Send');
    if (output1.toLowerCase().includes('error')) fail(`Got error response: ${output1.substring(0, 120)}`);
    pass(`Send button works → output: "${output1.substring(0, 80).replace(/\n/g, ' ')}…"`);

    // ── 5. Status returns to ok/idle after response ──────────────────────────
    await page.waitForFunction(
      () => ['ok', 'idle', ''].includes(document.getElementById('statusLabel')?.textContent?.trim()),
      null, { timeout: 5000 }
    );
    pass('status label returned to ok/idle after response');

    // ── 6. Enter key submits ─────────────────────────────────────────────────
    const before2 = await page.locator('#outputPane').innerText();
    await page.locator('#queryBox').fill('list esp32 devices');
    await page.locator('#queryBox').press('Enter');
    console.log('  Waiting for MCP response (query: "list esp32 devices")...');
    await waitForOutputChange(page, before2, 15000);
    const output2 = await page.locator('#outputPane').innerText();
    if (!output2.trim()) fail('Output pane empty after Enter-key submit');
    if (output2.toLowerCase().includes('error')) fail(`Got error response: ${output2.substring(0, 120)}`);
    pass(`Enter key submits → output: "${output2.substring(0, 80).replace(/\n/g, ' ')}…"`);

    // ── 7. Reset Model button ────────────────────────────────────────────────
    // Clear the query box first so output pane text is predictably "reset" text
    await page.locator('#queryBox').fill('');
    const before3 = await page.locator('#outputPane').innerText();
    await page.locator('#resetBtn').click();
    console.log('  Waiting for reset confirmation...');
    // Wait for output to contain reset-related keywords (up to 15s for reload)
    await page.waitForFunction(
      () => {
        const text = (document.getElementById('outputPane')?.innerText || '').toLowerCase();
        return text.includes('reset') || text.includes('reload') || text.includes('cleared');
      },
      null, { timeout: 15000 }
    );
    const output3 = await page.locator('#outputPane').innerText();
    if (!output3.toLowerCase().includes('reset') && !output3.toLowerCase().includes('reload') && !output3.toLowerCase().includes('cleared')) {
      fail(`Reset response didn't mention reset/reload/cleared: "${output3.substring(0, 120)}"`);
    }
    pass(`Reset Model button works → "${output3.substring(0, 80).replace(/\n/g, ' ')}…"`);

    // ── 8. Time / date query ─────────────────────────────────────────────────
    const before4 = await page.locator('#outputPane').innerText();
    await page.locator('#queryBox').fill('what time is it');
    await page.locator('#sendBtn').click();
    console.log('  Waiting for MCP response (query: "what time is it")...');
    await waitForOutputChange(page, before4, 10000);
    const output4 = await page.locator('#outputPane').innerText();
    if (!output4.match(/\d{2}:\d{2}:\d{2}/)) fail(`Time response missing HH:MM:SS pattern: "${output4.substring(0, 120)}"`);
    pass(`Time query works → "${output4.replace(/\s+/g,' ').trim().substring(0, 80)}…"`);

    // ── 9. Dashboard query ───────────────────────────────────────────────────
    const before5 = await page.locator('#outputPane').innerText();
    await page.locator('#queryBox').fill('show me the dashboard');
    await page.locator('#sendBtn').click();
    console.log('  Waiting for MCP response (query: "show me the dashboard")...');
    await waitForOutputChange(page, before5, 10000);
    const output5 = await page.locator('#outputPane').innerText();
    if (!output5.toLowerCase().includes('heap') && !output5.toLowerCase().includes('memory')) {
      fail(`Dashboard response missing heap/memory: "${output5.substring(0, 120)}"`);
    }
    pass(`Dashboard query works → "${output5.replace(/\s+/g,' ').trim().substring(0, 80)}…"`);

    // ── 10. Camera feed query ────────────────────────────────────────────────
    const before6 = await page.locator('#outputPane').innerHTML();
    await page.locator('#queryBox').fill('show me the feed from child1');
    await page.locator('#sendBtn').click();
    console.log('  Waiting for MCP response (query: "show me the feed from child1")...');
    await page.waitForFunction(
      () => document.getElementById('outputPane')?.innerHTML?.includes('192.168.2.157'),
      null, { timeout: 10000 }
    );
    const hasImg = await page.locator('#outputPane img').count();
    if (hasImg === 0) fail('Camera response missing <img> element');
    pass(`Camera feed query works → <img> rendered pointing at 192.168.2.157`);

    // ── 11. File attach label is clickable (input exists behind it) ──────────
    const uploadInput = page.locator('#uploadInput');
    const inputType   = await uploadInput.getAttribute('type');
    const inputMulti  = await uploadInput.getAttribute('multiple');
    if (inputType !== 'file') fail(`Upload input type is "${inputType}", expected "file"`);
    if (inputMulti === null) fail('Upload input missing "multiple" attribute');
    pass('file upload input present, type=file, multiple');

    // ── 12. Screenshot ───────────────────────────────────────────────────────
    await page.screenshot({ path: SCREENSHOT, fullPage: false });
    pass(`screenshot saved → ${SCREENSHOT}`);

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log('\n──────────────────────────────────────────');
    console.log('PASS  test-bob-console-playwright');
    console.log(`URL : ${CONSOLE_URL}`);
    if (netFail.length) {
      console.warn(`Network failures (non-fatal): ${netFail.join(', ')}`);
    }
    console.log('──────────────────────────────────────────\n');

  } catch (err) {
    console.error('\n──────────────────────────────────────────');
    console.error('FAIL  test-bob-console-playwright');
    console.error(err?.stack || String(err));
    if (logs.length) {
      console.error('\nBrowser console output:');
      logs.forEach(l => console.error(' ', l));
    }
    if (netFail.length) {
      console.error('\nNetwork failures:');
      netFail.forEach(f => console.error(' ', f));
    }
    console.error('──────────────────────────────────────────\n');
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
