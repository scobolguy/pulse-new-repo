import { executeProgram, loadOpcodeMap, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/index.mjs';

const INTEGER_MIN = -2147483648;
const INTEGER_MAX = 2147483647;

function requireInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < INTEGER_MIN || value > INTEGER_MAX) {
    throw new Error(`Assemblerish simulator: ${label} must be a signed 32-bit integer`);
  }
  return value;
}

function deviceRecord(programMap) {
  if (programMap?.sourceLanguage !== 'assemblerish'
    || !Array.isArray(programMap?.assemblerish?.devices)
    || !programMap.assemblerish.target) {
    throw new Error('Assemblerish simulator: invalid program map');
  }
  return new Map(programMap.assemblerish.devices.map(device => [device.name, device]));
}

function validatePinGrants(devices, allowedPins) {
  if (!Array.isArray(allowedPins) || allowedPins.some(pin => !Number.isInteger(pin) || pin < 0 || pin > 48)) {
    throw new Error('Assemblerish simulator: allowedPins must be an explicit array of GPIO numbers 0..48');
  }
  if (new Set(allowedPins).size !== allowedPins.length) {
    throw new Error('Assemblerish simulator: allowedPins must not contain duplicates');
  }
  const grants = new Set(allowedPins);
  for (const device of devices.values()) {
    if (!grants.has(device.pin)) {
      throw new Error(`Assemblerish simulator: GPIO ${device.pin} for '${device.name}' is not granted`);
    }
  }
}

export async function simulateAssemblerish(artifact, {
  allowedPins,
  inputs,
  dht,
  acceptEvents = true,
  debugLogger = () => {}
} = {}) {
  const programMap = artifact?.programMap;
  const devices = deviceRecord(programMap);
  validatePinGrants(devices, allowedPins);
  if (!artifact.pcodeText || typeof artifact.pcodeText !== 'string') {
    throw new Error('Assemblerish simulator: missing P-code text');
  }

  const calls = [];
  const events = [];
  const outputs = Object.fromEntries([...devices.values()]
    .filter(device => device.kind === 'relay' || device.kind === 'pwm')
    .map(device => [device.name, device.initial]));
  let dhtSample = null;
  let dhtDeviceName = null;
  let dhtStatusRead = false;
  let eventDelivered = false;
  const callHost = async (name, args) => {
    if (eventDelivered) {
      throw new Error(`Assemblerish simulator: host call '${name}' occurred after device.hal_event`);
    }
    calls.push({ name, args: [...args] });
    const device = devices.get(args[0]);
    switch (name) {
      case 'device.hal_read': {
        if (!device || device.kind !== 'input') throw new Error(`Assemblerish simulator: undeclared input '${args[0]}'`);
        if (!inputs || typeof inputs !== 'object' || !Object.hasOwn(inputs, device.name)) {
          throw new Error(`Assemblerish simulator: missing explicit input sample for '${device.name}'`);
        }
        const level = requireInteger(inputs[device.name], `input '${device.name}'`);
        if (level !== 0 && level !== 1) throw new Error(`Assemblerish simulator: input '${device.name}' must be 0 or 1`);
        return level;
      }
      case 'device.hal_write': {
        if (!device || device.kind !== 'relay') throw new Error(`Assemblerish simulator: undeclared relay '${args[0]}'`);
        const level = requireInteger(args[1], 'relay level');
        if (level !== 0 && level !== 1) throw new Error(`Assemblerish simulator: relay '${device.name}' level must be 0 or 1`);
        outputs[device.name] = level;
        return 1;
      }
      case 'device.hal_pwm': {
        if (!device || device.kind !== 'pwm') throw new Error(`Assemblerish simulator: undeclared PWM output '${args[0]}'`);
        const duty = requireInteger(args[1], 'PWM duty');
        const maxDuty = (2 ** device.bits) - 1;
        if (duty < 0 || duty > maxDuty) {
          throw new Error(`Assemblerish simulator: PWM '${device.name}' duty must be 0..${maxDuty}`);
        }
        outputs[device.name] = duty;
        return 1;
      }
      case 'device.hal_dht_read': {
        if (!device || device.kind !== 'dht11') throw new Error(`Assemblerish simulator: undeclared DHT11 '${args[0]}'`);
        if (dhtDeviceName && dhtDeviceName !== device.name) {
          throw new Error('Assemblerish simulator: only one DHT11 device may be sampled per invocation');
        }
        dhtDeviceName = device.name;
        if (!dhtStatusRead) {
          if (!dht || typeof dht !== 'object'
            || !Object.hasOwn(dht, 'valid')
            || !Object.hasOwn(dht, 'temperature')
            || !Object.hasOwn(dht, 'humidity')) {
            throw new Error(`Assemblerish simulator: provide an explicit DHT sample { valid, temperature, humidity } for '${device.name}'`);
          }
          const valid = requireInteger(dht.valid, 'DHT validity');
          if (valid !== 0 && valid !== 1) throw new Error('Assemblerish simulator: DHT validity must be 0 or 1');
          dhtSample = {
            valid,
            temperature: valid ? requireInteger(dht.temperature, 'DHT temperature') : 0,
            humidity: valid ? requireInteger(dht.humidity, 'DHT humidity') : 0
          };
          dhtStatusRead = true;
        }
        return dhtSample.valid;
      }
      case 'device.hal_temperature':
        if (!dhtStatusRead) throw new Error('Assemblerish simulator: DHT must be sampled before reading temperature');
        return dhtSample.temperature;
      case 'device.hal_humidity':
        if (!dhtStatusRead) throw new Error('Assemblerish simulator: DHT must be sampled before reading humidity');
        return dhtSample.humidity;
      case 'device.hal_event': {
        const [target, event, valid, value, auxiliary] = args;
        if (target !== programMap.assemblerish.target) {
          throw new Error(`Assemblerish simulator: event target mismatch '${target}'`);
        }
        if (!/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(event)) {
          throw new Error(`Assemblerish simulator: invalid event name '${event}'`);
        }
        if (![valid, value, auxiliary].every(Number.isSafeInteger)
          || valid < 0 || valid > 1
          || value < INTEGER_MIN || value > INTEGER_MAX
          || auxiliary < INTEGER_MIN || auxiliary > INTEGER_MAX) {
          throw new Error('Assemblerish simulator: invalid event payload');
        }
        if (!acceptEvents) throw new Error('Assemblerish simulator: device.hal_event delivery failed (ServiceHost queue rejected event)');
        const failedDht = dhtStatusRead && dhtSample.valid === 0;
        const deliveredValid = failedDht ? 0 : valid;
        const deliveredValue = failedDht ? 0 : value;
        const deliveredAuxiliary = failedDht ? 0 : auxiliary;
        events.push({
          handler: programMap.runtimeUnit.id,
          event,
          valid: deliveredValid,
          value: deliveredValue,
          auxiliary: deliveredAuxiliary
        });
        eventDelivered = true;
        return 1;
      }
      default:
        throw new Error(`Assemblerish simulator: host binding '${name}' is not permitted`);
    }
  };

  const result = await executeProgram({
    instructions: parsePcode(artifact.pcodeText),
    opcodeMap: await loadOpcodeMap(),
    programMap,
    runtimeContext: { callHost },
    debugLogger
  });
  if (result.error) {
    throw new Error(`Assemblerish simulator: PMachine execution failed: ${JSON.stringify(result.error)}`);
  }
  return { ...result, calls, events, outputs };
}
