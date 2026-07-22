import { chromium } from 'playwright';

async function run() {
  const targetUrl = process.argv[2] || 'http://127.0.0.1:5173/';
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const result = { steps: [], consoleLogs: [], networkErrors: [] };

  // Capture console logs
  page.on('console', (msg) => {
    console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
    result.consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  // Capture network errors
  page.on('response', (response) => {
    if (!response.ok()) {
      console.log(`[Network] ${response.status()} ${response.url()}`);
      result.networkErrors.push({ status: response.status(), url: response.url() });
    }
  });

  try {
    console.log(`Opening ${targetUrl}...`);
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });
    result.steps.push('page-loaded');

    // Navigate to Ollama Query page if on home
    const queryHeading = await page.locator('h1:has-text("Ollama Query")').isVisible().catch(() => false);
    if (!queryHeading) {
      console.log('Not on Ollama Query page, looking for navigation...');
      // Try to find and click Ollama Query link/button
      const ollamaLink = await page
        .getByRole('link', { name: /ollama/i })
        .or(page.getByRole('button', { name: /ollama/i }))
        .first()
        .click({ timeout: 5000 })
        .catch(() => {
          console.log('No explicit Ollama link, trying direct navigation...');
        });
    }

    result.steps.push('navigated-to-ollama-query');

    // Wait for the query input field
    const inputField = page.getByPlaceholder('Describe what you need to build…');
    await inputField.waitFor({ timeout: 10000 });
    result.steps.push('input-field-ready');

    // Fill in the query
    const queryText = 'show me all nodes on the network';
    console.log(`Typing query: "${queryText}"`);
    await inputField.fill(queryText);
    result.steps.push('query-entered');

    // Click the Ask Ollama button
    const askButton = page.getByRole('button', { name: /Ask Ollama/i });
    await askButton.waitFor({ timeout: 5000 });
    console.log('Clicking Ask Ollama button...');
    await askButton.click({ timeout: 10000 });
    result.steps.push('ask-button-clicked');

    // Wait for response - look for loading state or response text
    console.log('Waiting for Ollama response (can take 10-30 seconds)...');
    
    // Wait longer for Ollama response (can take 10-30 seconds)
    await page.waitForTimeout(5000);
    
    // Check if still loading
    const stillLoading = await page
      .getByRole('button', { name: /Querying/i })
      .isVisible()
      .catch(() => false);
    
    if (stillLoading) {
      console.log('Still querying, waiting more...');
      await page.waitForTimeout(10000);
    }
    
    // Try to find a response container or error message
    let responseFound = false;
    let errorFound = false;
    let responseText = '';

    try {
      // Look for any error message
      const errorMessage = page.locator('text=/Failed to fetch|error|Error/i').first();
      if (await errorMessage.isVisible({ timeout: 5000 }).catch(() => false)) {
        errorFound = true;
        errorText = await errorMessage.textContent();
        result.steps.push('error-response-visible');
        console.error('Error response:', errorText);
      }
    } catch (e) {
      // No error message
    }

    try {
      // Look for success response (generic content that's not error)
      const responseContent = page.locator('[role="status"]').or(page.locator('.response')).first();
      if (await responseContent.isVisible({ timeout: 10000 }).catch(() => false)) {
        responseFound = true;
        responseText = await responseContent.textContent();
        result.steps.push('response-visible');
        console.log('Response received:', responseText.substring(0, 200));
      }
    } catch (e) {
      // Check if there's any text content beyond the query itself
      const pageContent = await page.evaluate(() => document.body.textContent);
      if (pageContent && pageContent.length > 100) {
        responseFound = true;
        responseText = pageContent;
        result.steps.push('page-content-updated');
        console.log('Page content updated');
      }
    }

    if (!responseFound && !errorFound) {
      result.steps.push('waiting-for-async-response');
      // Wait a bit more for async operations
      await page.waitForTimeout(3000);
    }

    // Take screenshot for visual inspection
    await page.screenshot({ path: 'ollama-query-test.png' });
    result.steps.push('screenshot-captured');

    // Final status
    const finalContent = await page.evaluate(() => document.body.textContent);
    result.responseLength = finalContent.length;
    result.success = responseFound || finalContent.length > 500;
    result.contentPreview = finalContent.substring(0, 300);

    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  } catch (err) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          error: err.message,
          stack: err.stack,
          ...result,
        },
        null,
        2
      )
    );
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
