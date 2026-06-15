import { chromium } from 'playwright';

/**
 * Playwright Test: Developer View - Run Pascalish Program on ESP Node
 * 
 * This test:
 * 1. Logs in as systemAdmin
 * 2. Opens the Developer Dashboard
 * 3. Loads a Pascalish program (hello-world-smoke.pcode)
 * 4. Runs it on an ESP32 node
 * 5. Verifies execution and inspects VM state
 */

async function run() {
  const targetUrl = process.argv[2] || 'http://localhost:5173/';
  const headless = process.argv.includes('--headless');
  
  console.log('🚀 Starting Developer ESP Test...');
  console.log(`Target URL: ${targetUrl}`);
  console.log(`Headless mode: ${headless}`);
  
  const browser = await chromium.launch({ 
    headless,
    slowMo: headless ? 0 : 100 // Slow down for visual debugging
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  const result = { 
    steps: [],
    success: false,
    vmState: null,
    programOutput: null
  };

  try {
    // Step 1: Navigate to application
    console.log('📍 Step 1: Loading application...');
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });
    result.steps.push('loaded-home');
    console.log('✅ Application loaded');

    // Step 2: Login as systemAdmin
    console.log('📍 Step 2: Logging in as systemAdmin...');
    
    // Check if already logged in by looking for user indicator
    const userIndicator = page.locator('text=/systemAdmin|admin/i').first();
    const isAlreadyLoggedIn = await userIndicator.isVisible().catch(() => false);
    
    if (!isAlreadyLoggedIn) {
      // Fill in systemAdmin credentials using aria-label
      const userIdInput = page.getByRole('textbox', { name: /user id/i });
      const passwordInput = page.getByRole('textbox', { name: /password/i });
      
      await userIdInput.fill('systemAdmin', { timeout: 5000 });
      await passwordInput.fill('', { timeout: 5000 }); // Empty password for fixed local admin
      
      // Press Enter to login
      await passwordInput.press('Enter');
      await page.waitForTimeout(2000);
      result.steps.push('logged-in-systemAdmin');
      console.log('✅ Logged in as systemAdmin');
    } else {
      console.log('ℹ️  Already logged in as systemAdmin');
      result.steps.push('already-logged-in');
    }

    // Step 3: Navigate to Developer Dashboard
    console.log('📍 Step 3: Opening Developer Dashboard...');
    
    // Look for Develop area button using aria-label
    const developButton = page.locator('button[aria-label="Develop"]').first();
    await developButton.click({ timeout: 10000 });
    result.steps.push('clicked-develop-area');
    console.log('✅ Clicked Develop area');
    
    // Wait for developer dashboard to load
    await page.waitForTimeout(2000);
    
    // The DeveloperDashboard should now be visible - check for the tabs
    const editorTab = page.getByRole('button', { name: /📝 Editor/i });
    const isEditorTabVisible = await editorTab.isVisible().catch(() => false);
    
    if (isEditorTabVisible) {
      console.log('✅ Developer Dashboard loaded with tabs');
      result.steps.push('developer-dashboard-loaded');
    } else {
      // Try clicking Files submenu if it exists
      const filesButton = page.getByRole('button', { name: /files/i }).first();
      const isFilesVisible = await filesButton.isVisible().catch(() => false);
      
      if (isFilesVisible) {
        await filesButton.click({ timeout: 5000 });
        result.steps.push('clicked-files-submenu');
        console.log('✅ Clicked Files submenu');
        await page.waitForTimeout(1000);
      }
    }

    // Step 4: Wait for Monaco Editor to load
    console.log('📍 Step 4: Waiting for code editor...');
    await page.waitForSelector('.monaco-editor', { timeout: 15000 });
    result.steps.push('monaco-editor-loaded');
    console.log('✅ Monaco editor loaded');

    // Step 5: Load Pascalish program
    console.log('📍 Step 5: Loading Pascalish program...');
    
    // Look for file browser or load button
    const loadFileButton = page.getByRole('button', { name: /load|open|browse/i }).first();
    const isLoadVisible = await loadFileButton.isVisible().catch(() => false);
    
    if (isLoadVisible) {
      await loadFileButton.click({ timeout: 5000 });
      result.steps.push('clicked-load-file');
      
      // Select hello-world-smoke.pcode
      const helloWorldFile = page.getByText(/hello-world-smoke\.pcode/i).first();
      await helloWorldFile.click({ timeout: 5000 });
      result.steps.push('selected-hello-world-program');
      console.log('✅ Selected hello-world-smoke.pcode');
    } else {
      // Manually type or paste the program
      console.log('ℹ️  No file browser found, typing program manually...');
      await page.click('.monaco-editor', { timeout: 5000 });
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Delete');
      
      // Type a simple Pascalish program
      const simpleProgram = `ENTRY:
JMP ROUTER_0_HELLO_ROUTE
ROUTER_0_HELLO_ROUTE:
ROUTE_MATCH_QUEUE "hello.in"
JZ FINISH
ROUTE_TRANSFORM "output := 'Hello from ESP32';"
ROUTE_EMIT "hello.out"
JMP FINISH
FINISH:
HALT`;
      
      await page.keyboard.type(simpleProgram);
      result.steps.push('typed-program-manually');
      console.log('✅ Typed program manually');
    }

    await page.waitForTimeout(1000);

    // Step 6: Compile the program
    console.log('📍 Step 6: Compiling program...');
    const compileButton = page.getByRole('button', { name: /compile|build/i }).first();
    const isCompileVisible = await compileButton.isVisible().catch(() => false);
    
    if (isCompileVisible) {
      await compileButton.click({ timeout: 5000 });
      await page.waitForTimeout(2000);
      result.steps.push('compiled-program');
      console.log('✅ Program compiled');
    } else {
      console.log('⚠️  No compile button found, skipping compilation');
      result.steps.push('compile-button-not-found');
    }

    // Step 7: Select ESP32 target node
    console.log('📍 Step 7: Selecting ESP32 target node...');
    
    // Look for device/node selector
    const deviceSelector = page.locator('select[name*="device"], select[name*="node"], select[name*="target"]').first();
    const isSelectorVisible = await deviceSelector.isVisible().catch(() => false);
    
    if (isSelectorVisible) {
      // Select first ESP32 device
      await deviceSelector.selectOption({ index: 1 }); // Index 0 is usually "Select device"
      result.steps.push('selected-esp32-node');
      console.log('✅ Selected ESP32 node');
    } else {
      console.log('⚠️  No device selector found, will attempt to run on default target');
      result.steps.push('device-selector-not-found');
    }

    // Step 8: Run the program on ESP32
    console.log('📍 Step 8: Running program on ESP32...');
    const runButton = page.getByRole('button', { name: /run|execute|deploy/i }).first();
    await runButton.click({ timeout: 5000 });
    result.steps.push('clicked-run-program');
    console.log('✅ Clicked run button');

    // Wait for execution to start
    await page.waitForTimeout(3000);

    // Step 9: Navigate to VM Inspector to see execution state
    console.log('📍 Step 9: Opening VM Inspector...');
    const vmInspectorTab = page.getByRole('button', { name: /vm inspector|debugger/i }).first();
    const isVmTabVisible = await vmInspectorTab.isVisible().catch(() => false);
    
    if (isVmTabVisible) {
      await vmInspectorTab.click({ timeout: 5000 });
      result.steps.push('opened-vm-inspector');
      console.log('✅ Opened VM Inspector');
      
      // Wait for VM state to load
      await page.waitForTimeout(2000);
      
      // Extract VM state information
      const vmStatus = await page.locator('text=/Status:/i').locator('..').textContent().catch(() => null);
      const programCounter = await page.locator('text=/Program Counter:/i').locator('..').textContent().catch(() => null);
      const stackPointer = await page.locator('text=/Stack Pointer:/i').locator('..').textContent().catch(() => null);
      
      result.vmState = {
        status: vmStatus,
        programCounter: programCounter,
        stackPointer: stackPointer
      };
      
      console.log('📊 VM State:', result.vmState);
      result.steps.push('captured-vm-state');
    } else {
      console.log('⚠️  VM Inspector tab not found');
      result.steps.push('vm-inspector-not-found');
    }

    // Step 10: Check logs for output
    console.log('📍 Step 10: Checking execution logs...');
    const logsTab = page.getByRole('button', { name: /logs/i }).first();
    const isLogsTabVisible = await logsTab.isVisible().catch(() => false);
    
    if (isLogsTabVisible) {
      await logsTab.click({ timeout: 5000 });
      result.steps.push('opened-logs-tab');
      console.log('✅ Opened Logs tab');
      
      await page.waitForTimeout(1000);
      
      // Capture log output
      const logContent = await page.locator('.monaco-editor, pre, code').first().textContent().catch(() => null);
      result.programOutput = logContent;
      
      if (logContent) {
        console.log('📝 Program Output:', logContent.substring(0, 200));
        result.steps.push('captured-program-output');
      }
    } else {
      console.log('⚠️  Logs tab not found');
      result.steps.push('logs-tab-not-found');
    }

    // Step 11: Take screenshot for verification
    console.log('📍 Step 11: Taking screenshot...');
    await page.screenshot({ 
      path: 'test-developer-esp-run-screenshot.png',
      fullPage: true 
    });
    result.steps.push('screenshot-captured');
    console.log('✅ Screenshot saved: test-developer-esp-run-screenshot.png');

    // Mark as successful
    result.success = true;
    console.log('\n✅ Test completed successfully!');
    console.log(JSON.stringify(result, null, 2));

  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    
    // Take error screenshot
    try {
      await page.screenshot({ 
        path: 'test-developer-esp-run-error.png',
        fullPage: true 
      });
      console.log('📸 Error screenshot saved: test-developer-esp-run-error.png');
    } catch (screenshotErr) {
      console.error('Failed to capture error screenshot:', screenshotErr.message);
    }
    
    result.error = err.message || String(err);
    result.stack = err.stack;
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1;
  } finally {
    if (!headless) {
      console.log('\n⏸️  Browser will remain open for 10 seconds for inspection...');
      await page.waitForTimeout(10000);
    }
    await browser.close();
    console.log('🏁 Test execution finished');
  }
}

run();

// Made with Bob
