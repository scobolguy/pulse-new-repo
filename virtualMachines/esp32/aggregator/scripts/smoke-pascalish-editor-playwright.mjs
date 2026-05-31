import { chromium } from 'playwright';

async function run() {
  const targetUrl = process.argv[2] || 'http://127.0.0.1:5173/';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const result = { steps: [] };

  try {
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });
    result.steps.push('loaded-home');

    await page.getByRole('button', { name: /data librarian/i }).first().click({ timeout: 10000 });
    result.steps.push('clicked-data-librarian');

    await page.getByRole('button', { name: /pascalish editor/i }).first().click({ timeout: 10000 });
    result.steps.push('opened-pascalish-editor');

    await page.waitForSelector('.monaco-editor', { timeout: 15000 });
    result.steps.push('monaco-mounted');

    await page.click('.monaco-editor', { timeout: 10000 });
    await page.keyboard.type('\nVAR smokeTyped : LegacyMT103 FROM Librarian;');
    result.steps.push('typed-in-editor');

    await page.keyboard.press('Control+Space');
    await page.waitForTimeout(600);

    const suggestVisible = await page
      .locator('.suggest-widget')
      .first()
      .isVisible()
      .catch(() => false);
    result.steps.push(suggestVisible ? 'suggestions-visible' : 'suggestions-not-visible');

    const statusText = await page
      .locator('span')
      .filter({ hasText: /Librarian data types/i })
      .first()
      .textContent()
      .catch(() => null);

    console.log(JSON.stringify({ ok: true, ...result, statusText }, null, 2));
  } catch (err) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          ...result,
          error: String(err && err.message ? err.message : err),
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
