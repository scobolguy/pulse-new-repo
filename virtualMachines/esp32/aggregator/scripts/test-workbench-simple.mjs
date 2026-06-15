// Simple test to check if workbench loads
import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', error => console.error('PAGE ERROR:', error));
  
  console.log('Navigating to workbench...');
  await page.goto('http://localhost:5174/#/x');
  
  console.log('Waiting 5 seconds for Monaco to load...');
  await page.waitForTimeout(5000);
  
  // Check if Monaco loaded
  const monacoExists = await page.evaluate(() => {
    return typeof window.monaco !== 'undefined';
  });
  console.log('Monaco loaded:', monacoExists);
  
  // Check if code is visible
  const codeVisible = await page.evaluate(() => {
    const codeElements = document.querySelectorAll('.view-line');
    return codeElements.length > 0;
  });
  console.log('Code lines visible:', codeVisible);
  
  // Get any error messages
  const errors = await page.evaluate(() => {
    const errorDivs = Array.from(document.querySelectorAll('div')).filter(div => 
      div.textContent.includes('Error') || div.textContent.includes('error')
    );
    return errorDivs.map(div => div.textContent);
  });
  
  if (errors.length > 0) {
    console.log('Errors found:', errors);
  }
  
  // Take a screenshot
  await page.screenshot({ path: 'workbench-screenshots/debug-screenshot.png' });
  console.log('Screenshot saved to workbench-screenshots/debug-screenshot.png');
  
  console.log('\nPress Ctrl+C to close browser...');
  await page.waitForTimeout(60000); // Wait 1 minute
  
  await browser.close();
}

test().catch(console.error);

// Made with Bob
