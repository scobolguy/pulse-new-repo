const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
const REGISTER = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
const HANDLER_ID = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/;
const INTEGER = /^-?\d+$/;
const MIN_INT = -2147483648;
const MAX_INT = 2147483647;
const MAX_SOURCE_BYTES = 16 * 1024;
const MAX_INSTRUCTIONS = 256;
const RESERVED_ESP32_PINS = new Set([0, 3, 19, 20, ...Array.from({ length: 12 }, (_, index) => index + 26), ...Array.from({ length: 4 }, (_, index) => index + 43)]);

export class AssemblerishCompileError extends SyntaxError {
  constructor(line, message, sourceLine = '') {
    super(`Assemblerish line ${line}: ${message}`);
    this.name = 'AssemblerishCompileError';
    this.line = line;
    this.sourceLine = sourceLine;
  }
}

function fail(line, message) {
  throw new AssemblerishCompileError(line.number, message, line.text);
}

function stripComment(text) {
  let quote = false;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '"' && text[index - 1] !== '\\') quote = !quote;
    else if (!quote && (text[index] === ';' || text[index] === '#')) return text.slice(0, index);
  }
  return text;
}

function parseInteger(raw, line, label = 'integer') {
  if (!INTEGER.test(raw)) fail(line, `Expected ${label}, got '${raw}'`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < MIN_INT || value > MAX_INT) {
    fail(line, `${label} must fit a signed 32-bit integer`);
  }
  return value;
}

function parseTarget(raw, line) {
  let target;
  try {
    target = JSON.parse(raw);
  } catch {
    fail(line, 'TARGET must be a quoted string');
  }
  if (typeof target !== 'string' || !target.startsWith('/') || target.length > 96
    || /[\u0000-\u001f\u007f]/.test(target)) {
    fail(line, 'TARGET must start with /, contain at most 96 characters, and contain no control characters');
  }
  return target;
}

function parseOperand(raw, line) {
  if (INTEGER.test(raw)) return { kind: 'integer', value: parseInteger(raw, line) };
  if (!REGISTER.test(raw)) fail(line, `Invalid register or integer '${raw}'`);
  return { kind: 'register', name: raw };
}

function assertRegister(name, line) {
  if (!REGISTER.test(name) || name === '__discard') fail(line, `Invalid register name '${name}'`);
  return name;
}

function sourceLines(source) {
  return source.split(/\r\n|\n|\r/).map((text, index) => ({
    number: index + 1,
    text,
    code: stripComment(text).trim()
  }));
}

function parseTrigger(code, line) {
  let match = /^TRIGGER\s+EDGE\s+([A-Za-z][A-Za-z0-9_]*)\s+(FALLING|RISING|CHANGE)\s+DEBOUNCE\s+(\d+)$/i.exec(code);
  if (match) {
    const debounceMs = parseInteger(match[3], line, 'debounce interval');
    if (debounceMs < 1 || debounceMs > 2000) fail(line, 'Debounce interval must be between 1 and 2000 ms');
    return { kind: 'edge', device: match[1], edge: match[2].toLowerCase(), debounceMs };
  }
  match = /^TRIGGER\s+TIMER\s+(\d+)$/i.exec(code);
  if (match) {
    const intervalMs = parseInteger(match[1], line, 'timer interval');
    if (intervalMs < 50 || intervalMs > 86400000) fail(line, 'Timer interval must be between 50 and 86400000 ms');
    return { kind: 'timer', intervalMs };
  }
  fail(line, 'Expected TRIGGER EDGE device FALLING|RISING|CHANGE DEBOUNCE ms or TRIGGER TIMER ms');
}

function parseDeclaration(code, line) {
  let match = /^INPUT\s+([A-Za-z][A-Za-z0-9_]*)\s+PIN\s+(\d+)\s+(PULLUP|PULLDOWN|FLOATING)$/i.exec(code);
  if (match) {
    return {
      name: match[1], kind: 'input', pin: parseInteger(match[2], line, 'pin'),
      pull: match[3].toLowerCase()
    };
  }
  match = /^RELAY\s+([A-Za-z][A-Za-z0-9_]*)\s+PIN\s+(\d+)\s+ACTIVE\s+(HIGH|LOW)\s+INITIAL\s+([01])$/i.exec(code);
  if (match) {
    return {
      name: match[1], kind: 'relay', pin: parseInteger(match[2], line, 'pin'),
      activeLow: match[3].toUpperCase() === 'LOW', initial: Number(match[4])
    };
  }
  match = /^PWMOUT\s+([A-Za-z][A-Za-z0-9_]*)\s+PIN\s+(\d+)\s+CHANNEL\s+(\d+)\s+HZ\s+(\d+)\s+BITS\s+(\d+)\s+INITIAL\s+(\d+)$/i.exec(code);
  if (match) {
    return {
      name: match[1], kind: 'pwm', pin: parseInteger(match[2], line, 'pin'),
      channel: parseInteger(match[3], line, 'PWM channel'),
      hz: parseInteger(match[4], line, 'PWM frequency'),
      bits: parseInteger(match[5], line, 'PWM resolution'),
      initial: parseInteger(match[6], line, 'PWM initial duty')
    };
  }
  match = /^DHT11\s+([A-Za-z][A-Za-z0-9_]*)\s+PIN\s+(\d+)$/i.exec(code);
  if (match) {
    return { name: match[1], kind: 'dht11', pin: parseInteger(match[2], line, 'pin') };
  }
  return null;
}

function parseInstruction(code, line) {
  let match = /^READ\s+(\S+)\s+(\S+)$/i.exec(code);
  if (match) return { op: 'READ', register: assertRegister(match[1], line), device: match[2], line };
  match = /^WRITE\s+(\S+)\s+(\S+)$/i.exec(code);
  if (match) return { op: 'WRITE', device: match[1], value: parseOperand(match[2], line), line };
  match = /^PWM\s+(\S+)\s+(\S+)$/i.exec(code);
  if (match) return { op: 'PWM', device: match[1], value: parseOperand(match[2], line), line };
  match = /^DHT\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/i.exec(code);
  if (match) {
    return {
      op: 'DHT',
      valid: assertRegister(match[1], line),
      temperature: assertRegister(match[2], line),
      humidity: assertRegister(match[3], line),
      device: match[4],
      line
    };
  }
  match = /^SET\s+(\S+)\s+(\S+)$/i.exec(code);
  if (match) return { op: 'SET', register: assertRegister(match[1], line), value: parseInteger(match[2], line), line };
  match = /^EVENT\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/i.exec(code);
  if (match) {
    if (!IDENTIFIER.test(match[1])) fail(line, `Invalid event name '${match[1]}'`);
    return {
      op: 'EVENT', event: match[1], valid: parseOperand(match[2], line),
      value: parseOperand(match[3], line), auxiliary: parseOperand(match[4], line), line
    };
  }
  match = /^NOT\s+(\S+)$/i.exec(code);
  if (match) return { op: 'NOT', register: assertRegister(match[1], line), line };
  fail(line, `Unknown instruction or declaration '${code.split(/\s+/, 1)[0]}'`);
}

function publicDevice(device) {
  const { name, kind, pin, pull, activeLow, initial, channel, hz, bits } = device;
  return Object.fromEntries(Object.entries({ name, kind, pin, pull, activeLow, initial, channel, hz, bits })
    .filter(([, value]) => value !== undefined));
}

function validateDeclarations(devices, trigger, triggerLine) {
  if (devices.length > 8) fail(devices[8].line, 'A handler may declare at most 8 devices');
  const names = new Map();
  const pins = new Map();
  const channels = new Map();
  const dhtDevices = devices.filter(device => device.kind === 'dht11');
  if (dhtDevices.length > 1) fail(dhtDevices[1].line, 'A handler may declare at most one DHT11 device');
  for (const device of devices) {
    if (names.has(device.name)) fail(device.line, `Duplicate device '${device.name}'`);
    names.set(device.name, device);
    if (device.pin < 0 || device.pin > 48) fail(device.line, 'Pin must be between 0 and 48');
    if (RESERVED_ESP32_PINS.has(device.pin)) fail(device.line, `GPIO ${device.pin} is reserved on the ESP32-S3 target`);
    if (pins.has(device.pin)) fail(device.line, `Pin ${device.pin} is already assigned to '${pins.get(device.pin).name}'`);
    pins.set(device.pin, device);
    if (device.kind === 'pwm') {
      if (device.channel < 0 || device.channel > 7) fail(device.line, 'PWM channel must be between 0 and 7');
      if (channels.has(device.channel)) fail(device.line, `PWM channel ${device.channel} is already assigned`);
      const pairedChannel = device.channel ^ 1;
      const pairedDevice = channels.get(pairedChannel);
      if (pairedDevice && (pairedDevice.hz !== device.hz || pairedDevice.bits !== device.bits)) {
        fail(device.line, `PWM channel ${device.channel} shares a timer with channel ${pairedChannel}; hz and bits must match`);
      }
      channels.set(device.channel, device);
      if (device.hz < 1 || device.hz > 40000) fail(device.line, 'PWM frequency must be between 1 and 40000 Hz');
      if (device.bits < 1 || device.bits > 16) fail(device.line, 'PWM bits must be between 1 and 16');
      if (device.initial < 0 || device.initial > (2 ** device.bits) - 1) {
        fail(device.line, `PWM initial duty must be between 0 and ${(2 ** device.bits) - 1}`);
      }
    }
  }
  if (!trigger) return names;
  if (trigger.kind === 'edge') {
    const device = names.get(trigger.device);
    if (!device || device.kind !== 'input') fail(triggerLine, `Edge trigger '${trigger.device}' must name a declared INPUT`);
  }
  if (trigger.kind === 'timer') {
    const dht = devices.find(device => device.kind === 'dht11');
    if (dht && trigger.intervalMs < 2000) fail(dht.line, 'DHT11 handlers require a timer interval of at least 2000 ms');
  } else {
    const dht = devices.find(device => device.kind === 'dht11');
    if (dht) fail(dht.line, 'DHT11 devices are supported only with a TIMER trigger');
  }
  return names;
}

function factForOperand(operand, facts, line) {
  if (operand.kind === 'integer') return { min: operand.value, max: operand.value, constant: operand.value };
  const fact = facts.get(operand.name);
  if (!fact) fail(line, `Register '${operand.name}' is used before it is initialized`);
  return fact;
}

function writeFact(register, fact, facts) {
  facts.set(register, fact);
}

function emitOperand(operand, emit) {
  emit(operand.kind === 'integer' ? `PUSH_INT ${operand.value}` : `LOAD_NAME ${operand.name}`);
}

function compileInstructions(instructions, names, trigger, fileName) {
  if (instructions.length === 0) fail({ number: 1, text: '' }, 'Handler needs at least one instruction');
  const events = instructions.filter(instruction => instruction.op === 'EVENT');
  if (events.length !== 1) fail(events[1]?.line || instructions[0].line, 'A handler must contain exactly one EVENT instruction');
  if (instructions[instructions.length - 1].op !== 'EVENT') {
    fail(instructions[instructions.length - 1].line, 'EVENT must be the final source instruction');
  }
  const facts = new Map();
  const pcode = [];
  const sourceMap = {};
  const emit = (text, line) => {
    const index = pcode.length;
    pcode.push(text);
    sourceMap[index] = {
      sourceFile: fileName,
      sourceLanguage: 'assemblerish',
      sourceLine: line.number,
      sourceColumn: 1,
      sourceText: line.text,
      instruction: text
    };
  };
  let lastDhtValid = null;
  let dhtReadCount = 0;
  for (const instruction of instructions) {
    const { line } = instruction;
    if (instruction.op === 'READ') {
      const device = names.get(instruction.device);
      if (!device || device.kind !== 'input') fail(line, `READ requires a declared INPUT, got '${instruction.device}'`);
      emit(`PUSH_STR ${JSON.stringify(device.name)}`, line);
      emit('CALL_EXT device.hal_read 1', line);
      emit(`STORE_NAME ${instruction.register}`, line);
      writeFact(instruction.register, { min: 0, max: 1, constant: null }, facts);
    } else if (instruction.op === 'SET') {
      emit(`PUSH_INT ${instruction.value}`, line);
      emit(`STORE_NAME ${instruction.register}`, line);
      writeFact(instruction.register, {
        min: instruction.value, max: instruction.value, constant: instruction.value
      }, facts);
    } else if (instruction.op === 'NOT') {
      const fact = factForOperand({ kind: 'register', name: instruction.register }, facts, line);
      emit(`LOAD_NAME ${instruction.register}`, line);
      emit('NOT', line);
      emit(`STORE_NAME ${instruction.register}`, line);
      const constant = fact.constant === null ? null : Number(!fact.constant);
      writeFact(instruction.register, { min: 0, max: 1, constant }, facts);
    } else if (instruction.op === 'WRITE' || instruction.op === 'PWM') {
      const device = names.get(instruction.device);
      const expected = instruction.op === 'WRITE' ? 'relay' : 'pwm';
      if (!device || device.kind !== expected) fail(line, `${instruction.op} requires a declared ${expected.toUpperCase()} device`);
      const valueFact = factForOperand(instruction.value, facts, line);
      if (instruction.op === 'WRITE' && (valueFact.min < 0 || valueFact.max > 1)) {
        fail(line, 'WRITE level must be statically known to be 0 or 1');
      }
      if (instruction.op === 'PWM') {
        const maxDuty = (2 ** device.bits) - 1;
        if (valueFact.min < 0 || valueFact.max > maxDuty) {
          fail(line, `PWM duty must be statically known to be between 0 and ${maxDuty}`);
        }
      }
      emit(`PUSH_STR ${JSON.stringify(device.name)}`, line);
      emitOperand(instruction.value, text => emit(text, line));
      emit(`CALL_EXT device.${instruction.op === 'WRITE' ? 'hal_write' : 'hal_pwm'} 2`, line);
      emit('STORE_NAME __discard', line);
    } else if (instruction.op === 'DHT') {
      const device = names.get(instruction.device);
      if (!device || device.kind !== 'dht11') fail(line, 'DHT requires a declared DHT11 device');
      dhtReadCount += 1;
      if (dhtReadCount > 1) fail(line, 'A handler may read its DHT11 at most once per invocation');
      if (new Set([instruction.valid, instruction.temperature, instruction.humidity]).size !== 3) {
        fail(line, 'DHT output registers must be distinct');
      }
      emit(`PUSH_STR ${JSON.stringify(device.name)}`, line);
      emit('CALL_EXT device.hal_dht_read 1', line);
      emit(`STORE_NAME ${instruction.valid}`, line);
      emit('CALL_EXT device.hal_temperature 0', line);
      emit(`STORE_NAME ${instruction.temperature}`, line);
      emit('CALL_EXT device.hal_humidity 0', line);
      emit(`STORE_NAME ${instruction.humidity}`, line);
      writeFact(instruction.valid, { min: 0, max: 1, constant: null, dhtValid: true }, facts);
      writeFact(instruction.temperature, { min: MIN_INT, max: MAX_INT, constant: null }, facts);
      writeFact(instruction.humidity, { min: MIN_INT, max: MAX_INT, constant: null }, facts);
      lastDhtValid = instruction.valid;
    } else if (instruction.op === 'EVENT') {
      const valid = factForOperand(instruction.valid, facts, line);
      if (valid.min < 0 || valid.max > 1) fail(line, 'EVENT valid must be statically known to be 0 or 1');
      if (devicesHaveDht(names) && (!instruction.valid || instruction.valid.kind !== 'register'
        || instruction.valid.name !== lastDhtValid || !facts.get(lastDhtValid)?.dhtValid)) {
        fail(line, 'A DHT11 event must pass the latest DHT status register as its valid flag');
      }
      const value = factForOperand(instruction.value, facts, line);
      const auxiliary = factForOperand(instruction.auxiliary, facts, line);
      emit(`PUSH_STR ${JSON.stringify(trigger.target)}`, line);
      emit(`PUSH_STR ${JSON.stringify(instruction.event)}`, line);
      emitOperand(instruction.valid, (text) => emit(text, line));
      emitOperand(instruction.value, (text) => emit(text, line));
      emitOperand(instruction.auxiliary, (text) => emit(text, line));
      emit('CALL_EXT device.hal_event 5', line);
      emit('STORE_NAME __discard', line);
      emit('HALT', line);
      void value;
      void auxiliary;
    }
  }
  if (pcode.length > MAX_INSTRUCTIONS) {
    fail(instructions[instructions.length - 1].line, `Compiled handler exceeds ${MAX_INSTRUCTIONS} instructions`);
  }
  const pcodeText = `${pcode.join('\n')}\n`;
  if (Buffer.byteLength(pcodeText, 'utf8') > MAX_SOURCE_BYTES) {
    fail(instructions[instructions.length - 1].line, `Generated P-code exceeds ${MAX_SOURCE_BYTES} bytes`);
  }
  return { pcodeText, sourceMap };
}

function devicesHaveDht(names) {
  return [...names.values()].some(device => device.kind === 'dht11');
}

export function compileAssemblerish(sourceText, { fileName = 'program.asmish' } = {}) {
  if (typeof sourceText !== 'string') throw new TypeError('Assemblerish source must be a string');
  if (Buffer.byteLength(sourceText, 'utf8') > MAX_SOURCE_BYTES) {
    throw new AssemblerishCompileError(1, `Source exceeds ${MAX_SOURCE_BYTES} bytes`);
  }
  const lines = sourceLines(sourceText);
  const header = { id: null, target: null, trigger: null, targetLine: null };
  const devices = [];
  const instructions = [];
  let instructionsStarted = false;
  let ended = false;

  for (const line of lines) {
    const code = line.code;
    if (!code) continue;
    if (ended) fail(line, 'No source is allowed after END');
    if (code.toUpperCase() === 'END') {
      ended = true;
      continue;
    }
    if (!instructionsStarted) {
      let match = /^(?:HEADER\s+)?HANDLER\s+(\S+)$/i.exec(code);
      if (match) {
        if (header.id) fail(line, 'Duplicate HANDLER declaration');
        if (!HANDLER_ID.test(match[1])) fail(line, 'Handler id must match [A-Za-z][A-Za-z0-9_-]{0,31}');
        header.id = match[1];
        continue;
      }
      match = /^TARGET\s+(.+)$/i.exec(code);
      if (match) {
        if (header.target !== null) fail(line, 'Duplicate TARGET');
        header.target = parseTarget(match[1], line);
        header.targetLine = line;
        continue;
      }
      if (/^TRIGGER\b/i.test(code)) {
        if (header.trigger) fail(line, 'Duplicate TRIGGER');
        header.trigger = parseTrigger(code, line);
        header.triggerLine = line;
        continue;
      }
      const device = parseDeclaration(code, line);
      if (device) {
        devices.push({ ...device, line });
        continue;
      }
    }
    instructionsStarted = true;
    instructions.push(parseInstruction(code, line));
  }

  if (!header.id) throw new AssemblerishCompileError(1, 'Missing HANDLER id');
  if (header.target === null) throw new AssemblerishCompileError(1, 'Missing TARGET');
  if (!header.trigger) throw new AssemblerishCompileError(1, 'Missing TRIGGER');
  const names = validateDeclarations(devices, header.trigger, header.triggerLine);
  const compiled = compileInstructions(instructions, names, { ...header.trigger, target: header.target }, fileName);
  const metadataDevices = devices.map(publicDevice);
  const programMap = {
    version: 1,
    sourceLanguage: 'assemblerish',
    targets: ['js', 'esp32'],
    runtimeUnit: { kind: 'program', id: header.id },
    assemblerish: {
      version: 1,
      id: header.id,
      target: header.target,
      trigger: header.trigger,
      devices: metadataDevices
    },
    sourceMap: compiled.sourceMap
  };
  return {
    language: 'assemblerish',
    pcodeText: compiled.pcodeText,
    programMap,
    sourceMap: compiled.sourceMap
  };
}
