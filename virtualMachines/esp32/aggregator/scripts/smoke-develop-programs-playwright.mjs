import { chromium } from 'playwright';

const GLOBAL_TIMEOUT_MS = 90000;

async function run() {
  const targetUrl = process.argv[2] || 'http://127.0.0.1:5173/';
  console.log(`[smoke] starting develop smoke for ${targetUrl}`);

  const timeoutHandle = setTimeout(() => {
    console.log(
      JSON.stringify(
        {
          ok: false,
          url: targetUrl,
          steps: [],
          error: `Global timeout exceeded (${GLOBAL_TIMEOUT_MS} ms).`
        },
        null,
        2
      )
    );
    process.exit(1);
  }, GLOBAL_TIMEOUT_MS);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const result = { steps: [] };

  try {
    console.log('[smoke] goto');
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    result.steps.push('loaded-home');
    console.log('[smoke] loaded-home');

    console.log('[smoke] click develop');
    await page.getByRole('button', { name: /^develop$/i }).first().click({ timeout: 10000 });
    result.steps.push('opened-develop');
    console.log('[smoke] opened-develop');

    const explorer = page.locator('aside', { hasText: /Explorer/i }).first();
    await explorer.waitFor({ timeout: 15000 });
    result.steps.push('explorer-visible');
    console.log('[smoke] explorer-visible');

    await explorer.getByRole('button', { name: /new pascalish program/i }).first().click({ timeout: 10000 });
    result.steps.push('created-pascalish-program');
    console.log('[smoke] created-pascalish-program');

    const pascalishHeader = page.locator('h2').first();
    await pascalishHeader.waitFor({ timeout: 10000 });
    const pascalishFileName = (await pascalishHeader.textContent()) || '';
    if (!pascalishFileName.toLowerCase().endsWith('.pas')) {
      throw new Error(`Expected selected file to end with .pas, got: ${pascalishFileName}`);
    }
    result.steps.push('pascalish-file-selected');
    console.log('[smoke] pascalish-file-selected');

    await page.waitForSelector('.monaco-editor', { timeout: 15000 });
    result.steps.push('monaco-visible-for-pascalish');
    console.log('[smoke] monaco-visible-for-pascalish');

    await explorer.getByRole('button', { name: /new wfl program/i }).first().click({ timeout: 10000 });
    result.steps.push('created-wfl-program');
    console.log('[smoke] created-wfl-program');

    const workflowFileName = (await pascalishHeader.textContent()) || '';
    if (!workflowFileName.toLowerCase().endsWith('.wfl')) {
      throw new Error(`Expected selected file to end with .wfl, got: ${workflowFileName}`);
    }
    result.steps.push('wfl-file-selected');
    console.log('[smoke] wfl-file-selected');

    await page.waitForSelector('.monaco-editor', { timeout: 15000 });
    result.steps.push('monaco-visible-for-wfl');
    console.log('[smoke] monaco-visible-for-wfl');

    console.log(
      JSON.stringify(
        {
          ok: true,
          url: targetUrl,
          pascalishFileName,
          workflowFileName,
          ...result,
        },
        null,
        2
      )
    );
  } catch (err) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          url: targetUrl,
          ...result,
          error: String(err && err.message ? err.message : err),
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  } finally {
    clearTimeout(timeoutHandle);
    await browser.close();
  }
}

run();
