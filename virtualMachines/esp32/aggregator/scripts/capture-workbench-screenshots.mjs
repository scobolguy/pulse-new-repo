import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'workbench-screenshots';
const BASE_URL = 'http://localhost:5173';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function captureScreenshots() {
  console.log('🚀 Capturing IBM BOB Workbench Screenshots\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    // Screenshot 1: Original GUI
    console.log('📸 1/4: Capturing original GUI at /');
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-original-gui.png'), fullPage: true });
    console.log('   ✓ Saved: 01-original-gui.png\n');

    // Screenshot 2: Workbench Home (View Mode)
    console.log('📸 2/4: Capturing workbench at /#/x (view mode)');
    await page.goto(`${BASE_URL}/#/x`);
    await page.waitForTimeout(3000); // Wait for Monaco to load
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-workbench-view.png'), fullPage: true });
    console.log('   ✓ Saved: 02-workbench-view.png\n');

    // Screenshot 3: Debug Mode
    console.log('📸 3/4: Switching to debug mode');
    const modeSelect = page.locator('label:has-text("Mode:") + select');
    await modeSelect.selectOption('debug');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-workbench-debug.png'), fullPage: true });
    console.log('   ✓ Saved: 03-workbench-debug.png\n');

    // Screenshot 4: WFL Workflow
    console.log('📸 4/4: Switching to WFL workflow');
    const fileSelect = page.locator('label:has-text("File:") + select');
    await fileSelect.selectOption('sample-wfl');
    await modeSelect.selectOption('view');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-workbench-wfl.png'), fullPage: true });
    console.log('   ✓ Saved: 04-workbench-wfl.png\n');

    console.log('✅ All screenshots captured successfully!');
    console.log(`📁 Location: ${SCREENSHOT_DIR}/\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

captureScreenshots().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// Made with Bob
