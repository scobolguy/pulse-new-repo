import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const url = process.argv[2] || 'https://localhost/bob-console.html';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();

await page.addInitScript(() => {
  class FakeSpeechRecognition {
    constructor() {
      window.__fakeRecognizer = this;
    }
    start() {
      this.started = true;
    }
    stop() {
      this.onend?.();
    }
  }
  window.SpeechRecognition = FakeSpeechRecognition;
});

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const policy = await page.evaluate(async () => {
    const response = await fetch(location.href, { method: 'HEAD' });
    return response.headers.get('permissions-policy');
  });
  assert.match(policy || '', /microphone=\(self\)/);

  await page.locator('#talkBtn').click();
  assert.match(await page.locator('#talkBtn').innerText(), /Listening/);
  assert.equal(await page.locator('#statusLabel').innerText(), 'listening');

  await page.locator('#talkBtn').click();
  assert.match(await page.locator('#talkBtn').innerText(), /Push to Talk/);
  assert.equal(await page.locator('#statusLabel').innerText(), 'idle');

  await page.locator('#talkBtn').click();
  await page.evaluate(() => window.__fakeRecognizer.onerror?.({ error: 'not-allowed' }));
  assert.match(await page.locator('#talkBtn').innerText(), /Push to Talk/);
  assert.equal(await page.locator('#statusLabel').innerText(), 'microphone permission denied');

  console.log('[bob-push-to-talk] PASS: microphone policy, start/stop, and permission feedback');
} finally {
  await browser.close();
}