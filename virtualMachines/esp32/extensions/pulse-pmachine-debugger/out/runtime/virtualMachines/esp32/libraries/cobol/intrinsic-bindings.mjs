function finiteResult(name, value) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} produced a non-finite result`);
  return value;
}

function finiteInput(name, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} expects a finite number`);
  }
  return value;
}

function numericValues(serialized, name) {
  let values;
  try {
    values = JSON.parse(serialized);
  } catch (error) {
    throw new TypeError(`${name} expects a serialized numeric list: ${error.message}`);
  }
  if (!Array.isArray(values) || values.length === 0
    || values.some(value => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new TypeError(`${name} expects a non-empty list of finite numbers`);
  }
  return values;
}

function numericSummary(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const sum = values.reduce((total, value) => total + value, 0);
  const mean = sum / values.length;
  const variance = values.reduce((total, value) => total + ((value - mean) ** 2), 0) / values.length;
  return {
    sorted, sum, mean, variance,
    min: sorted[0], max: sorted.at(-1),
    median: values.length % 2
      ? sorted[(values.length - 1) / 2]
      : (sorted[(values.length / 2) - 1] + sorted[values.length / 2]) / 2
  };
}

function parseCobolNumber(rawValue, currency = false, currencySign = null) {
  if (typeof rawValue !== 'string') throw new TypeError('NUMVAL input must be text');
  let value = rawValue.trim().toUpperCase();
  let negative = false;
  const creditOrDebit = currency && /(CR|DB)$/.test(value);
  if (creditOrDebit) {
    negative = true;
    value = value.slice(0, -2);
  }
  value = value.replace(/\s/g, '');
  if (currency && currencySign === null) {
    value = value.replace(/[$£¥€]/g, '');
  } else if (currency) {
    if (typeof currencySign !== 'string' || [...currencySign].length !== 1) {
      throw new TypeError('NUMVAL-C currency sign must be one character');
    }
    const escapedSign = currencySign.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const signPattern = new RegExp(escapedSign, 'g');
    if ((value.match(signPattern) || []).length > 1) {
      throw new TypeError('NUMVAL-C input contains the currency sign more than once');
    }
    value = value.replace(signPattern, '');
  }
  let signCount = 0;
  if (/^[+-]/.test(value)) {
    negative = value[0] === '-';
    signCount += 1;
    value = value.slice(1);
  }
  if (/[+-]$/.test(value)) {
    if (signCount) throw new TypeError('NUMVAL input cannot have both leading and trailing signs');
    negative = value.at(-1) === '-';
    signCount += 1;
    value = value.slice(0, -1);
  }
  if (!currency && value.includes(',')) throw new TypeError('NUMVAL does not accept grouping commas');
  if (currency && value.includes(',')) {
    const [integerPart] = value.split('.');
    if (!/^\d{1,3}(?:,\d{3})+$/.test(integerPart)) {
      throw new TypeError('NUMVAL-C input has invalid comma grouping');
    }
    value = value.replace(/,/g, '');
  }
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) {
    throw new TypeError('NUMVAL input is not a valid numeric value');
  }
  const number = Number(value);
  if (!Number.isFinite(number)) throw new RangeError('NUMVAL input is outside the supported numeric range');
  return negative ? -number : number;
}

function makeDate(year, month, day, label) {
  if (!Number.isSafeInteger(year) || year < 1601 || year > 9999
    || !Number.isSafeInteger(month) || month < 1 || month > 12
    || !Number.isSafeInteger(day) || day < 1 || day > 31) {
    throw new RangeError(`${label} is outside the supported COBOL date range`);
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new RangeError(`${label} is not a valid calendar date`);
  }
  return date;
}

const COBOL_DATE_EPOCH = Date.UTC(1601, 0, 1);
const MILLISECONDS_PER_DAY = 86400000;

function integerOfDate(value) {
  const dateValue = finiteInput('host.math_integer_of_date', value);
  if (!Number.isSafeInteger(dateValue)) throw new RangeError('INTEGER-OF-DATE expects YYYYMMDD');
  const year = Math.floor(dateValue / 10000);
  const month = Math.floor((dateValue % 10000) / 100);
  const day = dateValue % 100;
  const date = makeDate(year, month, day, 'INTEGER-OF-DATE');
  return Math.floor((date.getTime() - COBOL_DATE_EPOCH) / MILLISECONDS_PER_DAY) + 1;
}

function dateOfInteger(value) {
  const ordinal = finiteInput('host.math_date_of_integer', value);
  if (!Number.isSafeInteger(ordinal) || ordinal < 1) {
    throw new RangeError('DATE-OF-INTEGER expects an integer of at least 1');
  }
  const date = new Date(COBOL_DATE_EPOCH + ((ordinal - 1) * MILLISECONDS_PER_DAY));
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() > 9999) {
    throw new RangeError('DATE-OF-INTEGER is outside the supported date range');
  }
  return (date.getUTCFullYear() * 10000) + ((date.getUTCMonth() + 1) * 100) + date.getUTCDate();
}

function integerOfDay(value) {
  const dayValue = finiteInput('host.math_integer_of_day', value);
  if (!Number.isSafeInteger(dayValue)) throw new RangeError('INTEGER-OF-DAY expects YYYYDDD');
  const year = Math.floor(dayValue / 1000);
  const day = dayValue % 1000;
  const date = makeDate(year, 1, 1, 'INTEGER-OF-DAY');
  const dateEnd = new Date(Date.UTC(year + 1, 0, 1));
  if (day < 1 || day > (dateEnd.getTime() - date.getTime()) / MILLISECONDS_PER_DAY) {
    throw new RangeError('INTEGER-OF-DAY has an invalid day-of-year');
  }
  date.setUTCDate(day);
  return Math.floor((date.getTime() - COBOL_DATE_EPOCH) / MILLISECONDS_PER_DAY) + 1;
}

function dayOfInteger(value) {
  const ordinal = finiteInput('host.math_day_of_integer', value);
  if (!Number.isSafeInteger(ordinal) || ordinal < 1) {
    throw new RangeError('DAY-OF-INTEGER expects an integer of at least 1');
  }
  const date = new Date(COBOL_DATE_EPOCH + ((ordinal - 1) * MILLISECONDS_PER_DAY));
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() > 9999) {
    throw new RangeError('DAY-OF-INTEGER is outside the supported date range');
  }
  const day = Math.floor((date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 1)) / MILLISECONDS_PER_DAY) + 1;
  return (date.getUTCFullYear() * 1000) + day;
}

function currentCobolDate() {
  const date = new Date();
  const offset = -date.getTimezoneOffset();
  const sign = offset < 0 ? '-' : '+';
  const absoluteOffset = Math.abs(offset);
  const zone = `${sign}${String(Math.floor(absoluteOffset / 60)).padStart(2, '0')}${String(absoluteOffset % 60).padStart(2, '0')}`;
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
    + `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`
    + `${String(date.getSeconds()).padStart(2, '0')}${String(Math.floor(date.getMilliseconds() / 10)).padStart(2, '0')}${zone}`;
}

function acceptedDateValue(kind) {
  const date = new Date();
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  if (kind === 'DATE') return `${year.slice(-2)}${month}${day}`;
  if (kind === 'DAY') {
    const firstDay = new Date(date.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((date - firstDay) / MILLISECONDS_PER_DAY) + 1;
    return `${year.slice(-2)}${String(dayOfYear).padStart(3, '0')}`;
  }
  if (kind === 'TIME') {
    return `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`
      + `${String(date.getSeconds()).padStart(2, '0')}${String(Math.floor(date.getMilliseconds() / 10)).padStart(2, '0')}`;
  }
  if (kind === 'DAY-OF-WEEK') return String(date.getDay() + 1);
  throw new TypeError(`Unsupported ACCEPT FROM source ${kind}`);
}

function seededRandom(seed) {
  const text = String(finiteInput('host.math_random_seeded', seed));
  let state = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    state = Math.imul(state ^ text.charCodeAt(index), 16777619);
  }
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return state / 0x100000000;
}

export function createDesktopIntrinsicBindings() {
  const unary = {
    acos: Math.acos,
    asin: Math.asin,
    atan: Math.atan,
    cos: Math.cos,
    sin: Math.sin,
    tan: Math.tan,
    log: Math.log,
    log10: Math.log10,
    sqrt: Math.sqrt,
    floor: Math.floor,
    trunc: Math.trunc
  };
  const bindings = Object.fromEntries(Object.entries(unary).map(([name, operation]) => [
    `host.math_${name}`,
    value => finiteResult(`host.math_${name}`, operation(finiteInput(`host.math_${name}`, value)))
  ]));

  bindings['host.math_factorial'] = value => {
    const number = finiteInput('host.math_factorial', value);
    if (!Number.isSafeInteger(number) || number < 0 || number > 170) {
      throw new RangeError('host.math_factorial expects an integer from 0 through 170');
    }
    let result = 1;
    for (let factor = 2; factor <= number; factor += 1) result *= factor;
    return finiteResult('host.math_factorial', result);
  };
  bindings['host.math_mod'] = (left, right) => {
    const dividend = finiteInput('host.math_mod', left);
    const divisor = finiteInput('host.math_mod', right);
    if (divisor === 0) throw new RangeError('host.math_mod divisor must not be zero');
    return finiteResult('host.math_mod', ((dividend % divisor) + divisor) % divisor);
  };
  bindings['host.math_rem'] = (left, right) => {
    const dividend = finiteInput('host.math_rem', left);
    const divisor = finiteInput('host.math_rem', right);
    if (divisor === 0) throw new RangeError('host.math_rem divisor must not be zero');
    return finiteResult('host.math_rem', dividend % divisor);
  };
  for (const name of ['mean', 'median', 'midrange', 'range', 'sum', 'variance', 'standard_deviation']) {
    bindings[`host.math_${name}`] = serialized => {
      const summary = numericSummary(numericValues(serialized, `host.math_${name}`));
      const result = {
        mean: summary.mean,
        median: summary.median,
        midrange: (summary.min + summary.max) / 2,
        range: summary.max - summary.min,
        sum: summary.sum,
        variance: summary.variance,
        standard_deviation: Math.sqrt(summary.variance)
      }[name];
      return finiteResult(`host.math_${name}`, result);
    };
  }
  bindings['host.math_ord_max'] = serialized => {
    const values = numericValues(serialized, 'host.math_ord_max');
    return values.indexOf(Math.max(...values)) + 1;
  };
  bindings['host.math_ord_min'] = serialized => {
    const values = numericValues(serialized, 'host.math_ord_min');
    return values.indexOf(Math.min(...values)) + 1;
  };
  bindings['host.math_numval'] = value => parseCobolNumber(value);
  bindings['host.math_numval_c'] = value => parseCobolNumber(value, true);
  bindings['host.math_numval_c_currency'] = (value, currencySign) =>
    parseCobolNumber(value, true, currencySign);
  bindings['host.math_integer_of_date'] = integerOfDate;
  bindings['host.math_date_of_integer'] = dateOfInteger;
  bindings['host.math_integer_of_day'] = integerOfDay;
  bindings['host.math_day_of_integer'] = dayOfInteger;
  bindings['host.math_annuity'] = (rateValue, periodValue) => {
    const rate = finiteInput('host.math_annuity', rateValue);
    const periods = finiteInput('host.math_annuity', periodValue);
    if (periods <= 0) throw new RangeError('ANNUITY expects a positive number of periods');
    const result = rate === 0 ? 1 / periods : rate / (1 - ((1 + rate) ** -periods));
    return finiteResult('host.math_annuity', result);
  };
  bindings['host.math_present_value'] = serialized => {
    const values = numericValues(serialized, 'host.math_present_value');
    const discountRate = values.at(-1);
    const payments = values.slice(0, -1);
    if (payments.length === 0 || 1 + discountRate <= 0) {
      throw new RangeError('PRESENT-VALUE requires at least one payment and a discount rate greater than -1');
    }
    const result = payments.reduce((total, payment, index) =>
      total + (payment / ((1 + discountRate) ** (index + 1))), 0);
    return finiteResult('host.math_present_value', Number(result.toPrecision(15)));
  };
  bindings['host.math_random'] = () => Math.random();
  bindings['host.math_random_seeded'] = seededRandom;
  bindings['host.cobol_char'] = value => {
    const codePoint = finiteInput('host.cobol_char', value);
    if (!Number.isSafeInteger(codePoint) || codePoint < 1 || codePoint > 0x110000) {
      throw new RangeError('CHAR expects an integer ordinal from 1 through 1114112');
    }
    return String.fromCodePoint(codePoint - 1);
  };
  bindings['host.cobol_ord'] = value => {
    if (typeof value !== 'string' || value.length === 0) throw new TypeError('ORD expects non-empty text');
    return value.codePointAt(0) + 1;
  };
  bindings['host.date_current'] = currentCobolDate;
  bindings['host.date_accept'] = acceptedDateValue;
  return bindings;
}
