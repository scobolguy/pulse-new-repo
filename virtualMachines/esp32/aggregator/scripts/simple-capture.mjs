import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = 'workbench-screenshots';
const BASE_URL = 'http://localhost:5173';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function capture() {
  console.log('📸 Capturing workbench screenshots...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    // Original GUI
    console.log('1. Original GUI');
    await page.goto(`${BASE_URL}/`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-original-gui.png'), fullPage: true });
    console.log('   ✓ Saved\n');

    // Workbench - View mode
    console.log('2. Workbench - View mode');
    await page.goto(`${BASE_URL}/#/x`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-workbench-view.png'), fullPage: true });
    console.log('   ✓ Saved\n');

    // Workbench - Debug mode (manual URL)
    console.log('3. Workbench - Debug mode');
    await page.goto(`${BASE_URL}/#/x?mode=debug`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-workbench-debug.png'), fullPage: true });
    console.log('   ✓ Saved\n');

    // Workbench - WFL view
    console.log('4. Workbench - WFL workflow');
    await page.goto(`${BASE_URL}/#/x?file=sample-wfl`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-workbench-wfl.png'), fullPage: true });
    console.log('   ✓ Saved\n');

    console.log('✅ Complete! Screenshots in:', SCREENSHOT_DIR);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

capture();

// Made with Bob
