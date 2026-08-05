import { chromium } from 'playwright';
import path from 'node:path';

const baseUrl = process.env.MEMO_BASE_URL || 'https://neptune';
const assetsDir = path.resolve('../../../documents/memos/assets');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  ignoreHTTPSErrors: true,
});
const page = await context.newPage();

async function captureMapper() {
  await page.goto(`${baseUrl}/data-mapper`);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'File ▾' }).click();
  await page.getByRole('button', { name: 'Open...' }).click();
  await page.getByRole('button', { name: 'Open', exact: true }).nth(3).click();
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(assetsDir, '01-mapper-schema-selection.png') });
  const table = page.locator('table');
  await table.screenshot({ path: path.join(assetsDir, '02-mapper-field-rules.png') });
  await table.locator('tr').filter({ has: page.locator('input') }).first().screenshot({
    path: path.join(assetsDir, '03-mapper-conversion-rule.png'),
  });

  const fields = {
    20: 'MSG-2026-001',
    21: 'E2E-001',
    '23B': 'CRED',
    '32A': { components: { valueDate: '2026-08-03', currency: 'CAD', amount: '1250.00' } },
    '50K': 'Example Sender',
    59: 'Example Receiver',
    70: 'Invoice 42',
    '71A': 'SHA',
  };
  await page.locator('textarea').fill(JSON.stringify({ finEnvelope: { block4: { fields } } }, null, 2));
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.getByText('Output Preview', { exact: true }).waitFor();
  await page.getByText('Output Preview', { exact: true }).locator('..').screenshot({
    path: path.join(assetsDir, '04-mapper-test-result.png'),
  });

  await page.goto(`${baseUrl}/api/mapper/maps`);
  await page.screenshot({ path: path.join(assetsDir, '05-mapper-service-call.png') });
}

async function captureFlowDesigner() {
  await page.goto(`${baseUrl}/flow-designer`);
  await page.waitForLoadState('networkidle');

  const newButton = page.getByRole('button', { name: 'New', exact: true });
  page.once('dialog', (dialog) => dialog.accept());
  await newButton.click();

  await page.getByText('Mapper', { exact: true }).click();
  await page.getByText('mapper1', { exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('MT103 to PACS Mapper');
  await page.locator('select').nth(1).selectOption('swift-mt103');
  await page.locator('select').nth(2).selectOption('pacs.008.001.14');
  await page.getByRole('button', { name: 'Save', exact: true }).last().click();

  await page.getByText('swift.mt103.inbound', { exact: true }).click();
  await page.getByText('iso20022.dispatch', { exact: true }).click();

  await page.getByText('queue1', { exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('MT103 Input Queue');
  await page.getByRole('button', { name: 'Save', exact: true }).last().click();

  await page.getByText('queue2', { exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('PACS Output Queue');
  await page.getByRole('button', { name: 'Save', exact: true }).last().click();

  const edgeSelect = page.locator('select').first();
  await page.getByText('MT103 Input Queue', { exact: true }).first().click();
  await edgeSelect.selectOption('message-broker-call');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.getByText('MT103 to PACS Mapper', { exact: true }).first().click();
  await edgeSelect.selectOption('transform-edge');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.getByText('PACS Output Queue', { exact: true }).first().click();
  await page.getByText('MT103 to PACS Mapper', { exact: true }).first().click();

  await page.screenshot({ path: path.join(assetsDir, '06-flow-mapper-node.png') });
}

try {
  await captureMapper();
  await captureFlowDesigner();
} finally {
  await browser.close();
}