import { chromium } from 'playwright';

// The default Pascalish demo is router/daemon-only (no executable begin...end.
// block), so the Single Step portion of this test replaces the editor content
// with a minimal program + procedure call before exercising Single Step.
const sampleProgram = [
  'program demo;',
  'procedure announce();',
  'begin',
  "  writeln('PAYMENTS READY');",
  'end;',
  'begin',
  '  announce();',
  'end.'
].join('\n');

async function run() {
  const targetUrl = process.argv[2] || 'http://127.0.0.1:5173/';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const result = { steps: [] };

  try {
    await page.goto(new URL('/pascalish', targetUrl).href, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });
    result.steps.push('loaded-pascalish');

    await page.waitForSelector('.monaco-editor', { timeout: 15000 });
    result.steps.push('monaco-mounted');

    await page.getByRole('button', { name: 'Compile', exact: true }).click({ timeout: 10000 });
    await page.getByText(/Compiled: \d+ router\(s\), \d+ mapping\(s\)\./).waitFor({ timeout: 15000 });
    result.steps.push('compiled-pascalish');

    await page.locator('.monaco-editor').first().click({ timeout: 10000 });
    await page.keyboard.press('Control+A');
    await page.keyboard.type(sampleProgram);
    result.steps.push('replaced-sample-for-stepping');

    const stepButton = page.getByRole('button', { name: 'Single Step', exact: true });
    await stepButton.click({ timeout: 10000 }); // announce(); -> PERFORM, opens tab
    await page.getByRole('tab', { name: 'announce', exact: true }).waitFor({ timeout: 10000 });
    result.steps.push('stepped-into-announce-tab');

    await stepButton.click({ timeout: 10000 }); // writeln('PAYMENTS READY'); -> DISPLAY
    await page.getByTestId('pascalish-step-log').filter({ hasText: 'DISPLAY: PAYMENTS READY' }).waitFor({ timeout: 10000 });
    result.steps.push('stepped-display');

    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
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
