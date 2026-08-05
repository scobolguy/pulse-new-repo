import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTemporalQueryService } from '../src/backend/modules/temporalQueryService.mjs';
import { matchAgentIntent, reloadAgentRoutes } from '../src/backend/agentRouteLoader.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-temporal-'));
const service = createTemporalQueryService({
  nowProvider: () => Date.parse('2026-08-03T23:30:00.000Z'),
  preferencesPath: path.join(root, 'preferences.json')
});

const weekday = service.query({ query: 'what day is August 6th', userId: 'eastern-user' });
assert.equal(weekday.date, '2026-08-06');
assert.equal(weekday.weekday, 'Thursday');
assert.equal(weekday.timeZone, 'America/New_York');

const singaporeSet = service.query({ query: 'set my timezone to Singapore', userId: 'singapore-user' });
assert.equal(singaporeSet.timeZone, 'Asia/Singapore');
const singaporeNow = service.query({ query: 'what date and time is it', userId: 'singapore-user' });
assert.equal(singaporeNow.current.day, 4);
assert.equal(singaporeNow.current.weekday, 'Tuesday');

const london = service.query({ query: 'what time is it in London', userId: 'singapore-user' });
assert.equal(london.timeZone, 'Europe/London');
assert.equal(london.userTimeZone, 'Asia/Singapore');

await reloadAgentRoutes();
for (const phrase of ['what day is August 6th', 'what time is it in Singapore', 'set my timezone to Singapore']) {
  assert.equal((await matchAgentIntent(phrase))?.intent?.id, 'temporal-query', phrase);
}

console.log('[temporal-query] PASS: weekday lookup, Eastern default, Singapore preference, and city override');