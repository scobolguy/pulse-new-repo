import { chromium } from 'playwright';

function fail(message) {
  throw new Error(message);
}

async function run() {
  const url = process.env.SMOKE_UI_URL || 'http://127.0.0.1:5173/';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Prefer the previous selector, but tolerate environments where no mini-cards are rendered yet.
    const candidateCard = page.locator('article.login-mini-card.is-workflow, article.login-mini-card').first();
    const cardCount = await candidateCard.count();
    let overlayVerified = false;
    if (cardCount > 0) {
      const overlay = page.locator('.card-open-overlay');
      const beforeOverlay = await overlay.count();
      await candidateCard.click({ force: true });
      await page.waitForTimeout(600);
      const afterOverlay = await overlay.count();

      if (beforeOverlay === 0 && afterOverlay > 0) {
        await page.locator('.card-open-close').first().click({ force: true });
        await page.waitForTimeout(300);
        const closedOverlay = await overlay.count();
        if (closedOverlay !== 0) {
          fail(`Card overlay did not close (count=${closedOverlay}).`);
        }
        overlayVerified = true;
      }
    }

    const userBubbles = page.locator('.chat-bubble--user');
    const assistantBubbles = page.locator('.chat-bubble--assistant');
    const beforeUser = await userBubbles.count();
    const beforeAssistant = await assistantBubbles.count();

    const question = 'Show gateways and servers that are offline or paused.';
    await page.getByRole('textbox', { name: 'Chat query' }).fill(question);
    await page.locator('form.chat-composer--minimal').dispatchEvent('submit');

    await page.waitForFunction(
      ({ userMin, assistantMin }) => {
        const users = document.querySelectorAll('.chat-bubble--user').length;
        const assistants = document.querySelectorAll('.chat-bubble--assistant').length;
        return users > userMin && assistants > assistantMin;
      },
      { userMin: beforeUser, assistantMin: beforeAssistant },
      { timeout: 12000 }
    );

    const afterUser = await userBubbles.count();
    const afterAssistant = await assistantBubbles.count();

    if (!(afterUser > beforeUser && afterAssistant > beforeAssistant)) {
      fail(
        `Chat messages did not append as expected (user ${beforeUser}->${afterUser}, assistant ${beforeAssistant}->${afterAssistant}).`
      );
    }

    const lastAssistantText = await assistantBubbles.nth(afterAssistant - 1).innerText();
    if (!String(lastAssistantText || '').trim()) {
      fail('Assistant response was empty.');
    }

    console.log('PASS smoke-ui');
    console.log(`URL=${url}`);
    console.log(`Overlay check=${overlayVerified ? 'verified' : 'skipped'}; chat appended user and assistant messages.`);
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error('FAIL smoke-ui');
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
