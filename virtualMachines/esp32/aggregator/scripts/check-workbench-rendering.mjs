import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console messages
  const messages = [];
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    messages.push({ type, text });
    console.log(`[${type.toUpperCase()}] ${text}`);
  });

  // Collect errors
  page.on('pageerror', error => {
    console.error('[PAGE ERROR]', error.message);
    messages.push({ type: 'error', text: error.message });
  });

  try {
    console.log('🔍 Navigating to workbench...');
    await page.goto('http://localhost:5173/#/x');
    
    console.log('⏳ Waiting for workbench to load...');
    await page.waitForTimeout(3000);

    // Check what's rendered
    const state = await page.evaluate(() => {
      return {
        url: window.location.href,
        hash: window.location.hash,
        title: document.title,
        hasWorkbench: !!document.querySelector('[data-testid="workbench-container"]'),
        hasMonaco: !!document.querySelector('.monaco-editor'),
        monacoLines: document.querySelectorAll('.view-line').length,
        bodyText: document.body.innerText.substring(0, 500),
      };
    });

    console.log('\n📊 Page State:');
    console.log(JSON.stringify(state, null, 2));

    console.log('\n📝 Console Messages:', messages.length);
    
    console.log('\n✅ Check complete. Press Ctrl+C to close browser...');
    await new Promise(() => {}); // Keep open

  } catch (error) {
    console.error('❌ Error:', error.message);
    await browser.close();
    process.exit(1);
  }
})();

// Made with Bob
