const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DEFAULT_CALENDARS = [
  {
    id: 'CA-ON', name: 'Ontario, Canada', timeZone: 'America/Toronto', weekendDays: [0, 6],
    aliases: ['ontario', 'toronto', 'canada', 'ca-on'],
    holidays: [
      ['fixed', 1, 1, "New Year's Day", 'nextWeekday'],
      ['nthWeekday', 2, 1, 3, 'Family Day'],
      ['easterOffset', -2, 'Good Friday'],
      ['mondayBefore', 5, 25, 'Victoria Day'],
      ['fixed', 7, 1, 'Canada Day', 'nextWeekday'],
      ['nthWeekday', 8, 1, 1, 'Civic Holiday'],
      ['nthWeekday', 9, 1, 1, 'Labour Day'],
      ['nthWeekday', 10, 1, 2, 'Thanksgiving'],
      ['fixed', 12, 25, 'Christmas Day', 'nextWeekday'],
      ['fixed', 12, 26, 'Boxing Day', 'nextWeekday'],
    ],
  },
  {
    id: 'CA-QC', name: 'Quebec, Canada', timeZone: 'America/Toronto', weekendDays: [0, 6],
    aliases: ['quebec', 'québec', 'montreal', 'montréal', 'ca-qc'],
    holidays: [
      ['fixed', 1, 1, "New Year's Day", 'nextWeekday'],
      ['easterOffset', -2, 'Good Friday'],
      ['mondayBefore', 5, 25, 'National Patriots Day'],
      ['fixed', 6, 24, 'Saint-Jean-Baptiste Day', 'nextWeekday'],
      ['fixed', 7, 1, 'Canada Day', 'nextWeekday'],
      ['nthWeekday', 9, 1, 1, 'Labour Day'],
      ['nthWeekday', 10, 1, 2, 'Thanksgiving'],
      ['fixed', 12, 25, 'Christmas Day', 'nextWeekday'],
    ],
  },
  {
    id: 'US-NY', name: 'New York, United States', timeZone: 'America/New_York', weekendDays: [0, 6],
    aliases: ['new york', 'ny', 'us', 'usa', 'united states', 'us-ny'],
    holidays: [
      ['fixed', 1, 1, "New Year's Day", 'nearestWeekday'],
      ['nthWeekday', 1, 1, 3, 'Martin Luther King Jr. Day'],
      ['nthWeekday', 2, 1, 3, "Presidents' Day"],
      ['lastWeekday', 5, 1, 'Memorial Day'],
      ['fixed', 6, 19, 'Juneteenth', 'nearestWeekday'],
      ['fixed', 7, 4, 'Independence Day', 'nearestWeekday'],
      ['nthWeekday', 9, 1, 1, 'Labor Day'],
      ['nthWeekday', 11, 4, 4, 'Thanksgiving'],
      ['fixed', 12, 25, 'Christmas Day', 'nearestWeekday'],
    ],
  },
  {
    id: 'GB-ENG', name: 'England and Wales', timeZone: 'Europe/London', weekendDays: [0, 6],
    aliases: ['england', 'wales', 'london', 'uk', 'united kingdom', 'gb', 'gb-eng'],
    holidays: [
      ['fixed', 1, 1, "New Year's Day", 'nextWeekday'],
      ['easterOffset', -2, 'Good Friday'],
      ['easterOffset', 1, 'Easter Monday'],
      ['nthWeekday', 5, 1, 1, 'Early May Bank Holiday'],
      ['lastWeekday', 5, 1, 'Spring Bank Holiday'],
      ['lastWeekday', 8, 1, 'Summer Bank Holiday'],
      ['fixed', 12, 25, 'Christmas Day', 'nextWeekday'],
      ['fixed', 12, 26, 'Boxing Day', 'nextWeekday'],
    ],
  },
];

function utcDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date, count) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + count);
  return result;
}

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDate(year, month, day);
}

function observedDate(date, policy) {
  const weekday = date.getUTCDay();
  if (policy === 'nearestWeekday') {
    if (weekday === 6) return addUtcDays(date, -1);
    if (weekday === 0) return addUtcDays(date, 1);
  }
  if (policy === 'nextWeekday') {
    if (weekday === 6) return addUtcDays(date, 2);
    if (weekday === 0) return addUtcDays(date, 1);
  }
  return date;
}

function holidayFromRule(year, rule) {
  const [kind, ...args] = rule;
  if (kind === 'fixed') {
    const [month, day, name, policy] = args;
    const actual = utcDate(year, month, day);
    return { actual, observed: observedDate(actual, policy), name };
  }
  if (kind === 'nthWeekday') {
    const [month, weekday, nth, name] = args;
    const first = utcDate(year, month, 1);
    const day = 1 + ((7 + weekday - first.getUTCDay()) % 7) + ((nth - 1) * 7);
    const actual = utcDate(year, month, day);
    return { actual, observed: actual, name };
  }
  if (kind === 'lastWeekday') {
    const [month, weekday, name] = args;
    const last = utcDate(year, month + 1, 0);
    const day = last.getUTCDate() - ((7 + last.getUTCDay() - weekday) % 7);
    const actual = utcDate(year, month, day);
    return { actual, observed: actual, name };
  }
  if (kind === 'easterOffset') {
    const [offset, name] = args;
    const actual = addUtcDays(easterSunday(year), offset);
    return { actual, observed: actual, name };
  }
  if (kind === 'mondayBefore') {
    const [month, day, name] = args;
    let actual = addUtcDays(utcDate(year, month, day), -1);
    while (actual.getUTCDay() !== 1) actual = addUtcDays(actual, -1);
    return { actual, observed: actual, name };
  }
  throw new Error(`Unsupported holiday rule: ${kind}`);
}

function datePartsInTimeZone(epochMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(new Date(epochMs));
  const value = type => Number(parts.find(part => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day') };
}

function parseRequestedMonth(query, today) {
  const normalized = String(query || '').toLowerCase();
  let year = Number(normalized.match(/\b(20\d{2})\b/)?.[1] || today.year);
  let month = MONTH_NAMES.findIndex(name => normalized.includes(name.toLowerCase())) + 1;
  if (!month) month = today.month;
  if (/\bnext\s+month\b/.test(normalized)) {
    month = today.month + 1;
    year = today.year;
    if (month === 13) { month = 1; year += 1; }
  }
  if (/\blast\s+month\b/.test(normalized)) {
    month = today.month - 1;
    year = today.year;
    if (month === 0) { month = 12; year -= 1; }
  }
  return { year, month };
}

export function createBusinessCalendarService({ nowProvider = () => Date.now(), calendars = DEFAULT_CALENDARS, defaultCalendarId = 'CA-ON' } = {}) {
  const byId = new Map(calendars.map(calendar => [calendar.id.toLowerCase(), calendar]));

  function resolveCalendar(query = '', requestedId = '') {
    const explicit = byId.get(String(requestedId || '').trim().toLowerCase());
    if (explicit) return explicit;
    const normalized = String(query || '').toLowerCase();
    const aliasMatch = calendars
      .flatMap(calendar => calendar.aliases.map(alias => ({ calendar, alias: alias.toLowerCase() })))
      .sort((left, right) => right.alias.length - left.alias.length)
      .find(item => normalized.includes(item.alias));
    return aliasMatch?.calendar || byId.get(defaultCalendarId.toLowerCase()) || calendars[0];
  }

  function getMonth({ query = '', calendarId = '', year, month } = {}) {
    const calendar = resolveCalendar(query, calendarId);
    if (!calendar) throw new Error('No business calendars are configured');
    const today = datePartsInTimeZone(nowProvider(), calendar.timeZone);
    const requested = parseRequestedMonth(query, today);
    const selectedYear = Number(year || requested.year);
    const selectedMonth = Number(month || requested.month);
    if (!Number.isInteger(selectedYear) || selectedYear < 1900 || selectedYear > 2200) throw new Error('year is invalid');
    if (!Number.isInteger(selectedMonth) || selectedMonth < 1 || selectedMonth > 12) throw new Error('month is invalid');

    const holidays = new Map();
    for (const rule of calendar.holidays || []) {
      const holiday = holidayFromRule(selectedYear, rule);
      const actualKey = dateKey(holiday.actual);
      const observedKey = dateKey(holiday.observed);
      holidays.set(actualKey, holiday.name);
      if (observedKey !== actualKey) holidays.set(observedKey, `${holiday.name} (observed)`);
    }

    const daysInMonth = utcDate(selectedYear, selectedMonth + 1, 0).getUTCDate();
    const todayKey = `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;
    const days = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = utcDate(selectedYear, selectedMonth, day);
      const key = dateKey(date);
      const weekend = calendar.weekendDays.includes(date.getUTCDay());
      const holiday = holidays.get(key) || null;
      days.push({
        date: key,
        day,
        weekday: date.getUTCDay(),
        weekend,
        holiday,
        businessDay: !weekend && !holiday,
        today: key === todayKey,
      });
    }

    return {
      calendar: { id: calendar.id, name: calendar.name, timeZone: calendar.timeZone, weekendDays: calendar.weekendDays },
      year: selectedYear,
      month: selectedMonth,
      monthName: MONTH_NAMES[selectedMonth - 1],
      days,
      businessDayCount: days.filter(day => day.businessDay).length,
      holidays: days.filter(day => day.holiday).map(day => ({ date: day.date, name: day.holiday })),
      authoritativeNow: new Date(nowProvider()).toISOString(),
    };
  }

  function listCalendars() {
    return calendars.map(({ id, name, timeZone, weekendDays, aliases }) => ({ id, name, timeZone, weekendDays, aliases }));
  }

  return { getMonth, listCalendars, resolveCalendar };
}

export { DEFAULT_CALENDARS, MONTH_NAMES };