import { chromium } from 'playwright';

const targetUrl = process.argv[2] || 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(new URL('/vbish', targetUrl).href, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('.monaco-editor', { timeout: 15000 });
  const stepButton = page.getByRole('button', { name: 'Single Step', exact: true });
  await stepButton.click({ timeout: 10000 }); // Dim status As String -> ASSIGN
  await stepButton.click({ timeout: 10000 }); // status = "ready" -> ASSIGN
  await stepButton.click({ timeout: 10000 }); // Announce() -> CALL, opens tab
  await page.getByRole('tab', { name: 'Announce', exact: true }).waitFor({ timeout: 10000 });
  await stepButton.click({ timeout: 10000 }); // Dim message As String -> ASSIGN
  await stepButton.click({ timeout: 10000 }); // message = "ready for payments" -> ASSIGN
  await page.getByTestId('vbish-step-log').filter({ hasText: 'message = "ready for payments"' }).waitFor({ timeout: 10000 });
  console.log(JSON.stringify({ ok: true, steps: ['loaded-vbish', 'monaco-mounted', 'stepped-into-announce-tab', 'stepped-assign'] }, null, 2));
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
