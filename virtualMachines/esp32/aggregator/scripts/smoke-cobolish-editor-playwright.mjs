import { chromium } from 'playwright';

const targetUrl = process.argv[2] || 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(new URL('/cobolish', targetUrl).href, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('.monaco-editor', { timeout: 15000 });
  await page.getByRole('button', { name: 'Single Step', exact: true }).click({ timeout: 10000 });
  await page.getByRole('tab', { name: 'ANNOUNCE-READY', exact: true }).waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: 'Single Step', exact: true }).click({ timeout: 10000 });
  await page.getByTestId('cobolish-step-log').filter({ hasText: 'DISPLAY: PAYMENTS READY' }).waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: 'Compile & Run', exact: true }).click({ timeout: 10000 });
  await page.getByText(/Ran service payments-core; 1 output line\(s\), 0 delivery\(s\)\./).waitFor({ timeout: 15000 });
  await page.locator('[data-testid="language-runtime-output"] .monaco-editor').filter({ hasText: 'PAYMENTS READY' }).waitFor({ timeout: 10000 });
  console.log(JSON.stringify({ ok: true, steps: ['loaded-cobolish', 'monaco-mounted', 'stepped-perform-tab', 'stepped-display', 'compiled-and-ran-cobolish'] }, null, 2));
} catch (error) {
  console.log(JSON.stringify({
    ok: false,
    error: String(error?.message || error),
    pageText: await page.locator('body').innerText().catch(() => '')
  }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}