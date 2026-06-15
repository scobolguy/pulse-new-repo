// Playwright Walkthrough Script for IBM BOB Workbench
// This script demonstrates the workbench features with screenshots and explanations

import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const BASE_URL = 'http://localhost:5174';
const SCREENSHOTS_DIR = './workbench-screenshots';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function takeScreenshot(page, name, description) {
  const filename = `${name}.png`;
  const filepath = join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`\n📸 Screenshot: ${filename}`);
  console.log(`   ${description}`);
  return filepath;
}

async function runWalkthrough() {
  console.log('🚀 Starting IBM BOB Workbench Walkthrough\n');
  console.log('=' .repeat(80));

  // Create screenshots directory
  await mkdir(SCREENSHOTS_DIR, { recursive: true });

  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    // Step 1: Show original GUI
    console.log('\n📍 STEP 1: Original GUI (Intact)');
    console.log('-'.repeat(80));
    await page.goto(BASE_URL);
    await sleep(2000);
    await takeScreenshot(
      page,
      '01-original-gui',
      'The original GUI at localhost:5174/ remains completely intact'
    );

    // Step 2: Navigate to experimental workbench
    console.log('\n📍 STEP 2: Navigate to Experimental Workbench');
    console.log('-'.repeat(80));
    await page.goto(`${BASE_URL}/#/x`);
    await sleep(2000);
    await takeScreenshot(
      page,
      '02-workbench-home',
      'The experimental workbench at localhost:5174/#/x with Hello World program loaded'
    );

    // Step 3: Show the navigation controls
    console.log('\n📍 STEP 3: Workbench Navigation Controls');
    console.log('-'.repeat(80));
    console.log('The top bar contains:');
    console.log('  • Role selector (developer, dataMapper, analyst, projectManager)');
    console.log('  • File selector (hello-world.pas, payment-router.pas, etc.)');
    console.log('  • Mode selector (view, edit, run, debug, animate)');
    await takeScreenshot(
      page,
      '03-navigation-controls',
      'Navigation bar showing role, file, and mode selectors'
    );

    // Step 4: Hello World in View Mode
    console.log('\n📍 STEP 4: Hello World - View Mode');
    console.log('-'.repeat(80));
    console.log('Viewing hello-world.pas with Monaco editor integration');
    console.log('Features:');
    console.log('  • Syntax highlighting');
    console.log('  • Line numbers');
    console.log('  • Language server support');
    await sleep(1000);
    await takeScreenshot(
      page,
      '04-hello-world-view',
      'Hello World program in view mode with Monaco editor'
    );

    // Step 5: Switch to Debug Mode
    console.log('\n📍 STEP 5: Hello World - Debug Mode');
    console.log('-'.repeat(80));
    console.log('Switching to debug mode...');
    await page.selectOption('select:has-text("Mode:")', 'debug');
    await sleep(2000);
    console.log('Debug mode shows:');
    console.log('  • Current line highlighted (line 8)');
    console.log('  • Registers panel (PC, SP, BP)');
    console.log('  • Stack contents');
    console.log('  • Variables panel');
    await takeScreenshot(
      page,
      '05-hello-world-debug',
      'Debug mode with current line highlighting and debug panels'
    );

    // Step 6: Switch to Payment Router
    console.log('\n📍 STEP 6: Complex Pascalish Program');
    console.log('-'.repeat(80));
    console.log('Switching to payment-router.pas...');
    await page.selectOption('select:has-text("File:")', 'sample-pascalish');
    await page.selectOption('select:has-text("Mode:")', 'view');
    await sleep(2000);
    console.log('This shows a more complex program with:');
    console.log('  • Daemon declaration');
    console.log('  • Library imports');
    console.log('  • Router definitions');
    console.log('  • Type annotations from librarian');
    await takeScreenshot(
      page,
      '06-payment-router-view',
      'Complex payment router program with librarian integration'
    );

    // Step 7: WFL Workflow View
    console.log('\n📍 STEP 7: WFL Workflow - View Mode');
    console.log('-'.repeat(80));
    console.log('Switching to order-workflow.wfl...');
    await page.selectOption('select:has-text("File:")', 'sample-wfl');
    await sleep(2000);
    console.log('WFL workflow rendered as Mermaid state diagram');
    console.log('Shows:');
    console.log('  • States: Idle, Processing, Validation, Complete, Error');
    console.log('  • Transitions with labels');
    console.log('  • Clean visual representation');
    await takeScreenshot(
      page,
      '07-wfl-view',
      'WFL workflow as static Mermaid state diagram'
    );

    // Step 8: WFL Workflow Run Mode (Animated)
    console.log('\n📍 STEP 8: WFL Workflow - Run Mode (Animated)');
    console.log('-'.repeat(80));
    console.log('Switching to run mode...');
    await page.selectOption('select:has-text("Mode:")', 'run');
    await sleep(3000);
    console.log('Run mode features:');
    console.log('  • Active states highlighted in green');
    console.log('  • Animation cycles through states');
    console.log('  • Execution history panel');
    console.log('  • Real-time state tracking');
    await takeScreenshot(
      page,
      '08-wfl-run-animated',
      'WFL workflow in run mode with animated state highlighting'
    );
    await sleep(2000);
    await takeScreenshot(
      page,
      '09-wfl-run-animated-2',
      'WFL workflow animation showing different active state'
    );

    // Step 9: Data Mapping View
    console.log('\n📍 STEP 9: Data Mapping - View Mode');
    console.log('-'.repeat(80));
    console.log('Switching to mt103-to-pain001.map...');
    await page.selectOption('select:has-text("Role:")', 'dataMapper');
    await page.selectOption('select:has-text("File:")', 'sample-map');
    await page.selectOption('select:has-text("Mode:")', 'view');
    await sleep(2000);
    console.log('Data mapping spreadsheet shows:');
    console.log('  • Source fields (blue)');
    console.log('  • Target fields (green)');
    console.log('  • Transform functions (gray)');
    console.log('  • Clean table layout');
    await takeScreenshot(
      page,
      '10-map-view',
      'Data mapping in spreadsheet view showing source, transform, and target'
    );

    // Step 10: Data Mapping Debug Mode
    console.log('\n📍 STEP 10: Data Mapping - Debug Mode');
    console.log('-'.repeat(80));
    console.log('Switching to debug mode...');
    await page.selectOption('select:has-text("Mode:")', 'debug');
    await sleep(2000);
    console.log('Debug mode features:');
    console.log('  • Current mapping highlighted (orange)');
    console.log('  • Previous mappings shown (green)');
    console.log('  • Visual flow: Source → Transform → Target');
    console.log('  • Progress bar and step counter');
    console.log('  • Detail panel showing current mapping');
    await takeScreenshot(
      page,
      '11-map-debug',
      'Data mapping debug mode with step-by-step execution visualization'
    );

    // Step 11: Node Card View
    console.log('\n📍 STEP 11: Node Information - Card View');
    console.log('-'.repeat(80));
    console.log('Switching to payment-service node...');
    await page.selectOption('select:has-text("Role:")', 'analyst');
    await page.selectOption('select:has-text("File:")', 'sample-node');
    await page.selectOption('select:has-text("Mode:")', 'view');
    await sleep(2000);
    console.log('Node card displays:');
    console.log('  • Service icon and name');
    console.log('  • Type and status badges');
    console.log('  • Description');
    console.log('  • Metadata table');
    await takeScreenshot(
      page,
      '12-node-card',
      'Node information displayed as a card with status and metadata'
    );

    // Step 12: Back to Hello World
    console.log('\n� STEP 12: Return to Hello World');
    console.log('-'.repeat(80));
    console.log('Returning to hello-world.pas...');
    await page.selectOption('select:has-text("Role:")', 'developer');
    await page.selectOption('select:has-text("File:")', 'hello-world');
    await page.selectOption('select:has-text("Mode:")', 'view');
    await sleep(2000);
    await takeScreenshot(
      page,
      '13-hello-world-final',
      'Back to Hello World - demonstrating smooth navigation'
    );

    // Step 13: Return to original GUI
    console.log('\n📍 STEP 13: Return to Original GUI');
    console.log('-'.repeat(80));
    console.log('Navigating back to original GUI...');
    await page.goto(BASE_URL);
    await sleep(2000);
    await takeScreenshot(
      page,
      '14-back-to-original',
      'Original GUI still intact - both routes work independently'
    );

    console.log('\n' + '='.repeat(80));
    console.log('✅ Walkthrough Complete!');
    console.log(`\n📁 Screenshots saved to: ${SCREENSHOTS_DIR}/`);
    console.log('\nScreenshots taken:');
    console.log('  01-original-gui.png          - Original GUI at /');
    console.log('  02-workbench-home.png        - Workbench home');
    console.log('  03-navigation-controls.png   - Navigation bar');
    console.log('  04-hello-world-view.png      - Hello World view mode');
    console.log('  05-hello-world-debug.png     - Hello World debug mode');
    console.log('  06-payment-router-view.png   - Complex Pascalish program');
    console.log('  07-wfl-view.png              - WFL static diagram');
    console.log('  08-wfl-run-animated.png      - WFL animated (frame 1)');
    console.log('  09-wfl-run-animated-2.png    - WFL animated (frame 2)');
    console.log('  10-map-view.png              - Data mapping view');
    console.log('  11-map-debug.png             - Data mapping debug');
    console.log('  12-node-card.png             - Node card view');
    console.log('  13-hello-world-final.png     - Return to Hello World');
    console.log('  14-back-to-original.png      - Back to original GUI');

  } catch (error) {
    console.error('\n❌ Error during walkthrough:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the walkthrough
runWalkthrough().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// Made with Bob
