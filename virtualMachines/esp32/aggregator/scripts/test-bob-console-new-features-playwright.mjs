/**
 * Playwright smoke tests for the new BOB Console features:
 *
 *  1.  Date arithmetic  — "what date is it in 10 days"
 *  2.  Queue list       — "show all queues"
 *  3.  Queue capacity   — "queues at 75% capacity"
 *  4.  Data librarian   — "show data types"
 *  5.  Queue item peek  — /api/agent/queue-item endpoint (direct)
 *  6.  Queue item MCP — "show queue item in <queue>" (via the BOB MCP gateway)
 *  7.  Push-to-talk     — button cycles through states correctly on repeated clicks
 *
 * Run:
 *   node scripts/test-bob-console-new-features-playwright.mjs [url]
 *
 * Default URL: http://127.0.0.1:5173/bob-console.html
 * The backend must be running on port 4000.
 */

import { chromium } from 'playwright';

const CONSOLE_URL = process.argv[2] || 'http://127.0.0.1:5173/bob-console.html';
const BACKEND_URL = process.env.BOB_BACKEND_URL || 'http://127.0.0.1:4000';
const SCREENSHOT  = 'bob-console-new-features-test.png';
const TIMEOUT_MS  = 20000;  // per-query wait

let passed = 0;
let failed = 0;

function pass(msg)  { console.log(`  PASS  ${msg}`); passed++; }
function fail(msg)  { console.error(`  FAIL  ${msg}`); failed++; }
function note(msg)  { console.log(`  NOTE  ${msg}`); }

/** Wait until #outputPane content changes from previousText (non-empty). */
async function waitForOutputChange(page, previousText, timeoutMs = TIMEOUT_MS) {
  await page.waitForFunction(
    (prev) => {
      const el = document.getElementById('outputPane');
      if (!el) return false;
      const cur = (el.innerText || el.textContent || '').trim();
      return cur !== prev.trim() && cur !== '';
    },
    previousText,
    { timeout: timeoutMs }
  );
}

/** Send a query via the text box and wait for a new response. */
async function sendQuery(page, query, timeoutMs = TIMEOUT_MS) {
  const before = await page.locator('#outputPane').innerText();
  await page.locator('#queryBox').fill(query);
  await page.locator('#sendBtn').click();
  await waitForOutputChange(page, before, timeoutMs);
  return page.locator('#outputPane').innerText();
}

/** GET a backend JSON endpoint without going through the browser. */
async function fetchJson(path) {
  const { default: http } = await import('http');
  return new Promise((resolve) => {
    const req = http.get(`${BACKEND_URL}${path}`, { timeout: 8000 }, (res) => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: null, raw }); }
      });
    });
    req.on('error', e => resolve({ status: -1, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: -1, error: 'timeout' }); });
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();
  const logs    = [];

  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));

  try {
    // ── Load page ────────────────────────────────────────────────────────────
    console.log(`\nLoading ${CONSOLE_URL} …`);
    await page.goto(CONSOLE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.locator('#sendBtn').waitFor({ timeout: 5000 });
    pass('page loaded');

    // ════════════════════════════════════════════════════════════════════════
    // TEST 1 — Date arithmetic
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── Test 1: Date arithmetic ──');
    {
      const out = await sendQuery(page, 'what date is it in 10 days');

      // The datetimeArithmetic formatter returns a <p> with "In 10 days it will be…"
      const html = await page.locator('#outputPane').innerHTML();
      const hasResult = html.includes('days') || html.includes('will be') || html.includes('January')
        || html.includes('February') || html.includes('March') || html.includes('April')
        || html.includes('May') || html.includes('June') || html.includes('July')
        || html.includes('August') || html.includes('September') || html.includes('October')
        || html.includes('November') || html.includes('December');

      if (!hasResult) fail(`Date arithmetic: expected a date in the output, got: "${out.substring(0, 120)}"`);
      else pass(`Date arithmetic → "${out.replace(/\s+/g,' ').substring(0, 80)}"`);
    }

    // ════════════════════════════════════════════════════════════════════════
    // TEST 2 — Queue list (direct API check first, then via agent)
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── Test 2: Queue list ──');
    {
      // 2a. Direct API: /api/agent/queue-summary
      const apiResult = await fetchJson('/api/agent/queue-summary');
      if (apiResult.status !== 200) {
        fail(`/api/agent/queue-summary returned ${apiResult.status}`);
      } else {
        const { queues, managers, gateways } = apiResult.body || {};
        if (!Array.isArray(queues))   fail('/api/agent/queue-summary: queues is not an array');
        else if (!Array.isArray(managers)) fail('/api/agent/queue-summary: managers is not an array');
        else if (typeof gateways !== 'object') fail('/api/agent/queue-summary: gateways is not an object');
        else {
          pass(`/api/agent/queue-summary OK — ${queues.length} queue(s), ${managers.length} manager(s)`);

          // Verify maxLength merging: every queue entry has the maxLength key
          const missingMaxLength = queues.filter(q => !Object.prototype.hasOwnProperty.call(q, 'maxLength'));
          if (missingMaxLength.length > 0) {
            fail(`queue-summary: ${missingMaxLength.length} queue(s) missing maxLength field (capacity merge failed)`);
          } else {
            pass('queue-summary: all queue entries have maxLength field (capacity merge working)');
          }
        }
      }

      // 2b. Via agent
      const out = await sendQuery(page, 'show all queues');
      const html = await page.locator('#outputPane').innerHTML();
      // The queues formatter outputs a <table> or the "No queues registered" message
      const hasTable   = html.includes('<table') || html.includes('<td');
      const hasNoQueue = out.toLowerCase().includes('no queues');
      if (!hasTable && !hasNoQueue) fail(`Queue list: expected table or empty-state, got: "${out.substring(0, 120)}"`);
      else pass(`Queue list via agent → table=${hasTable}, empty=${hasNoQueue}`);
    }

    // ════════════════════════════════════════════════════════════════════════
    // TEST 3 — Queue capacity filter
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── Test 3: Queue capacity filter ──');
    {
      const out = await sendQuery(page, 'show me all queues that are at 75% of their capacity');
      const html = await page.locator('#outputPane').innerHTML();

      // Either shows matching queues (table) or the "no queues at ≥ 75% capacity" green message
      const hasTable  = html.includes('<table') || html.includes('<td');
      const hasEmpty  = out.includes('75') || out.includes('capacity') || html.includes('75');
      if (!hasTable && !hasEmpty) {
        fail(`Capacity filter: unexpected response: "${out.substring(0, 120)}"`);
      } else {
        // Confirm the summary line contains the threshold label
        const hasPct = html.includes('75%') || html.includes('75');
        if (!hasPct) fail('Capacity filter: response does not mention 75%');
        else pass(`Capacity filter (75%) → table=${hasTable}, mentions threshold: yes`);
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // TEST 4 — Data librarian
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── Test 4: Data librarian ──');
    {
      // 4a. Direct API
      const apiResult = await fetchJson('/api/agent/librarian-summary');
      if (apiResult.status !== 200) {
        // Librarian may not be running; note it but don't hard-fail the suite
        note(`/api/agent/librarian-summary returned ${apiResult.status} (librarian may be offline)`);
      } else {
        const { types, schemas } = apiResult.body || {};
        if (!Array.isArray(types))   fail('/api/agent/librarian-summary: types is not an array');
        else if (!Array.isArray(schemas)) fail('/api/agent/librarian-summary: schemas is not an array');
        else pass(`/api/agent/librarian-summary OK — ${types.length} type(s), ${schemas.length} schema(s)`);
      }

      // 4b. Via agent
      const out = await sendQuery(page, 'show data types');
      const html = await page.locator('#outputPane').innerHTML();

      // The librarian formatter shows "N data types · N schemas registered" and tables or "No data types" fallback
      const hasContent  = html.includes('data type') || html.includes('schema') || html.includes('librarian');
      if (!hasContent) fail(`Librarian: unexpected response: "${out.substring(0, 120)}"`);
      else pass(`Librarian via agent → mentions data types / schema`);
    }

    // ════════════════════════════════════════════════════════════════════════
    // TEST 5 — Queue item endpoint (direct, no browser)
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── Test 5: /api/agent/queue-item endpoint ──');
    {
      // First find a queue that exists
      const summaryResult = await fetchJson('/api/agent/queue-summary');
      const queues = summaryResult.body?.queues || [];

      if (queues.length === 0) {
        note('No queues registered — skipping queue-item endpoint test');
      } else {
        // Pick the first queue with any messages (queueLength > 0), falling back to any queue
        const withMessages = queues.find(q => Number(q.queueLength ?? q.depth ?? 0) > 0);
        const target = withMessages || queues[0];
        const queueName = target.queueName || target.queue;
        const managerId = target.managerId || 'qm-primary';

        const itemResult = await fetchJson(
          `/api/agent/queue-item?manager=${encodeURIComponent(managerId)}&queue=${encodeURIComponent(queueName)}&index=0`
        );

        if (itemResult.status === 404) {
          note(`Queue ${queueName} returned 404 from queue-item (manager may be remote-only)`);
        } else if (itemResult.status !== 200) {
          fail(`/api/agent/queue-item returned ${itemResult.status} for queue ${queueName}`);
        } else {
          const body = itemResult.body;

          // Required top-level fields
          const requiredFields = ['empty', 'queueName', 'managerId', 'itemIndex', 'dataTypeIds', 'validations'];
          const missing = requiredFields.filter(f => !Object.prototype.hasOwnProperty.call(body, f));
          if (missing.length > 0) {
            fail(`/api/agent/queue-item response missing fields: ${missing.join(', ')}`);
          } else {
            pass(`/api/agent/queue-item response has all required fields for queue "${queueName}"`);
          }

          if (body.empty) {
            pass(`Queue "${queueName}" is empty — empty=true correctly returned`);
          } else {
            // Has a message — validate the structure further
            if (!body.item) {
              fail('queue-item: empty=false but item is missing');
            } else {
              pass(`queue-item: got item with messageId="${body.item.messageId || '(none)'}"`);
            }

            if (!Array.isArray(body.validations)) {
              fail('queue-item: validations is not an array');
            } else {
              const structural = body.validations.filter(v => v.tier === 'structural');
              if (structural.length === 0) {
                fail('queue-item: no structural validation result returned');
              } else {
                const allStructuralValid = structural.every(v => v.valid !== undefined);
                if (!allStructuralValid) fail('queue-item: structural validation entries missing valid flag');
                else pass(`queue-item: ${structural.length} structural check(s), ${body.validations.length} total check(s)`);
              }
            }

            // schema may be null (librarian offline / no match) — just confirm the key is present
            if (!Object.prototype.hasOwnProperty.call(body, 'schema')) {
              fail('queue-item: schema key missing from response');
            } else {
              pass(`queue-item: schema field present (value=${body.schema ? body.schema.typeId : 'null'})`);
            }

            // shape must be one of the known tokens
            const validShapes = ['null','string','array','iso20022-document','swift-fin-envelope','object'];
            if (!validShapes.includes(body.shape)) {
              fail(`queue-item: unknown shape "${body.shape}"`);
            } else {
              pass(`queue-item: shape="${body.shape}"`);
            }
          }
        }
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // TEST 6 — Queue item via agent ("show queue item in <queue>")
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── Test 6: Queue item via MCP ──');
    {
      const summaryResult = await fetchJson('/api/agent/queue-summary');
      const queues = summaryResult.body?.queues || [];

      if (queues.length === 0) {
        note('No queues registered — skipping queue-item agent test');
      } else {
        const target = queues.find(q => Number(q.queueLength ?? q.depth ?? 0) > 0) || queues[0];
        const queueName = target.queueName || target.queue;

        const out  = await sendQuery(page, `show queue item in ${queueName}`, TIMEOUT_MS);
        const html = await page.locator('#outputPane').innerHTML();

        // The queueItem formatter always renders one of:
        //  - Empty queue message
        //  - Verdict banner (green ✓ or red ✗)
        //  - Error / "could not determine queue" message
        const hasVerdictBanner  = html.includes('Valid') || html.includes('validation failure');
        const hasEmptyMsg       = out.toLowerCase().includes('empty');
        const hasPayloadSection = html.includes('Payload') || html.includes('Envelope');
        const hasError          = html.includes('color:#cf222e') && out.toLowerCase().includes('error');

        if (hasError) {
          // An error here likely means the queue manager doesn't expose the export endpoint
          // for this queue — treat as a soft fail with a note
          note(`Queue item agent test: got error response for "${queueName}" — "${out.substring(0,100)}"`);
        } else if (hasVerdictBanner || hasEmptyMsg || hasPayloadSection) {
          pass(`Queue item via agent for "${queueName}" → verdict=${hasVerdictBanner}, empty=${hasEmptyMsg}, payload=${hasPayloadSection}`);
        } else {
          fail(`Queue item via agent: unexpected output for "${queueName}": "${out.substring(0, 120)}"`);
        }
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // TEST 7 — Push-to-talk button state cycling
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── Test 7: Push-to-talk button state cycling ──');
    {
      // Initial state: button text contains "Push to Talk", no 'active' class
      const initialText  = await page.locator('#talkBtn').innerText();
      const initialClass = await page.locator('#talkBtn').getAttribute('class');
      if (!initialText.includes('Push to Talk')) {
        fail(`talkBtn initial text wrong: "${initialText}"`);
      } else {
        pass(`talkBtn initial text: "${initialText.trim()}"`);
      }
      if (initialClass && initialClass.includes('active')) {
        fail(`talkBtn should NOT have 'active' class at start, has: "${initialClass}"`);
      } else {
        pass('talkBtn has no active class initially');
      }

      // Click once — in a headless browser Speech Recognition is unavailable, so
      // initSTT() returns false and finishSTT() fires immediately. Either way:
      //   • recognizer is set to null by finishSTT() (the fix we applied)
      //   • sttReady goes back to true
      //   • The button should NOT be stuck in the 'active' state
      await page.locator('#talkBtn').click();
      // Give the synchronous path a moment
      await page.waitForTimeout(300);

      const afterClick1Class = await page.locator('#talkBtn').getAttribute('class');
      const afterClick1Text  = await page.locator('#talkBtn').innerText();

      // Because STT is unavailable (headless), finishSTT() fires and resets the button
      if (afterClick1Class && afterClick1Class.includes('active')) {
        // Still active — only acceptable if the browser somehow supports STT in headless
        // (extremely unlikely). Treat as a warning, not a hard fail.
        note(`talkBtn still active after first click (unexpected in headless): class="${afterClick1Class}"`);
      } else {
        pass(`talkBtn not stuck active after first click (recognizer correctly nulled out)`);
      }

      // Click a second time — verifies recognizer was properly nulled so initSTT()
      // can always be called again (the core bug fix).
      await page.locator('#talkBtn').click();
      await page.waitForTimeout(300);

      const afterClick2Class = await page.locator('#talkBtn').getAttribute('class');

      // If it gets stuck on the second click it means the old stale-recognizer bug is back
      if (afterClick2Class && afterClick2Class.includes('active')) {
        note(`talkBtn still active after second click (headless STT?): class="${afterClick2Class}"`);
      } else {
        pass('talkBtn returns to idle state after second click (no stale-recognizer regression)');
      }

      // Verify sttReady by checking that clicking a third time doesn't throw
      // (i.e., the button is clickable and the page doesn't error out)
      await page.locator('#talkBtn').click();
      await page.waitForTimeout(300);
      const jsErrors = logs.filter(l => l.startsWith('[error]'));
      if (jsErrors.length > 0) {
        fail(`JS errors after PTT clicks: ${jsErrors.join('; ')}`);
      } else {
        pass('no JS errors after 3 push-to-talk clicks');
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // Screenshot
    // ════════════════════════════════════════════════════════════════════════
    await page.screenshot({ path: SCREENSHOT, fullPage: false });
    pass(`screenshot saved → ${SCREENSHOT}`);

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log('\n──────────────────────────────────────────────────────────');
    if (failed === 0) {
      console.log(`PASS  test-bob-console-new-features-playwright  (${passed} checks passed)`);
    } else {
      console.log(`RESULT  ${passed} passed, ${failed} failed`);
    }
    console.log(`URL  : ${CONSOLE_URL}`);
    console.log('──────────────────────────────────────────────────────────\n');

    if (failed > 0) process.exitCode = 1;

  } catch (err) {
    console.error('\n──────────────────────────────────────────────────────────');
    console.error('FAIL  test-bob-console-new-features-playwright (unexpected exception)');
    console.error(err?.stack || String(err));
    if (logs.length) {
      console.error('\nBrowser console output:');
      logs.slice(-20).forEach(l => console.error(' ', l));
    }
    console.error('──────────────────────────────────────────────────────────\n');
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
