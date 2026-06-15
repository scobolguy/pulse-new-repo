import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen to console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    console.log(`[${type.toUpperCase()}] ${text}`);
  });

  // Listen to page errors
  page.on('pageerror', error => {
    console.error('[PAGE ERROR]', error.message);
  });

  // Navigate to workbench
  await page.goto('http://localhost:5173/#/x');
  
  // Wait for workbench to load
  await page.waitForSelector('[data-testid="workbench-container"]', { timeout: 10000 });
  console.log('✓ Workbench loaded');

  // Wait a bit for Monaco to initialize
  await page.waitForTimeout(3000);

  // Check Monaco state
  const monacoState = await page.evaluate(() => {
    const container = document.querySelector('.monaco-editor');
    const lines = document.querySelectorAll('.view-line');
    return {
      containerExists: !!container,
      containerClasses: container?.className || 'none',
      lineCount: lines.length,
      firstLineText: lines[0]?.textContent || 'none',
    };
  });

  console.log('Monaco state:', JSON.stringify(monacoState, null, 2));

  console.log('\nPress Ctrl+C to close browser...');
  await new Promise(() => {}); // Keep browser open
})();

// Made with Bob
