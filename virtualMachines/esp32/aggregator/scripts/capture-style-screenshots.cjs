const { chromium } = require('c:/dev/pulse-new-repo/virtualMachines/esp32/aggregator/node_modules/playwright');

(async () => {
  const pageUrl = 'http://127.0.0.1:4174/';
  const outDir = 'c:/dev/pulse-new-repo/virtualMachines/esp32/aggregator';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1680, height: 980 } });
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });

  const styleSelect = page.locator('select[aria-label="Style"]');
  await styleSelect.waitFor({ state: 'visible', timeout: 120000 });

  await styleSelect.selectOption('art-deco');
  await page.waitForTimeout(900);
  await page.screenshot({ path: outDir + '/screenshot-art-deco.png', fullPage: true });

  await styleSelect.selectOption('moderne');
  await page.waitForTimeout(900);
  await page.screenshot({ path: outDir + '/screenshot-moderne.png', fullPage: true });

  await browser.close();
  console.log('Saved screenshots');
})();
