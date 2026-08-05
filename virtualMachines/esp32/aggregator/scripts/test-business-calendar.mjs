import assert from 'node:assert/strict';
import { createBusinessCalendarService } from '../src/backend/modules/businessCalendarService.mjs';
import { matchAgentIntent, reloadAgentRoutes } from '../src/backend/agentRouteLoader.mjs';

const service = createBusinessCalendarService({
  nowProvider: () => Date.parse('2026-08-03T12:00:00.000Z'),
});

const ontario = service.getMonth({ query: 'show me the calandar for this month in Toronto' });
assert.equal(ontario.calendar.id, 'CA-ON');
assert.equal(ontario.monthName, 'August');
assert.equal(ontario.year, 2026);
assert.equal(ontario.days.length, 31);
assert.equal(ontario.days.find(day => day.date === '2026-08-03')?.holiday, 'Civic Holiday');
assert.equal(ontario.days.find(day => day.date === '2026-08-03')?.businessDay, false);
assert.equal(ontario.days.find(day => day.date === '2026-08-08')?.weekend, true);

const newYork = service.getMonth({ query: 'business calendar for New York in July 2026' });
assert.equal(newYork.calendar.id, 'US-NY');
assert.equal(newYork.days.find(day => day.date === '2026-07-03')?.holiday, 'Independence Day (observed)');

await reloadAgentRoutes();
for (const phrase of [
  'show me the calandar for this month',
  'show the business calendar for Ontario',
  'display the calaendar for London next month',
]) {
  const match = await matchAgentIntent(phrase);
  assert.equal(match?.intent?.id, 'calendar', `Expected calendar intent for: ${phrase}`);
}

console.log('[business-calendar] PASS: geographic calendars, holidays, business days, and typo routing');