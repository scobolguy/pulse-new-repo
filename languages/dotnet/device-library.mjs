import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createScalarLibrary } from './scalar-library.mjs';

const sourceFile = fileURLToPath(new URL('./libraries/Devices/devices.pcode', import.meta.url));
const template = readFileSync(sourceFile, 'utf8');

export function createDeviceLibrary({ id = 'Devices', name, type, pin } = {}) {
  if (!/^[A-Za-z0-9_.-]+$/.test(name || '') || !/^[A-Za-z0-9_-]+$/.test(type || '')
    || !Number.isInteger(pin) || pin < 0 || pin > 255) {
    throw new TypeError('Device library requires a device name, driver type and GPIO pin (0..255)');
  }
  const methods = {
    Open: { parameters: [], result: 'int' },
    SetPower: { parameters: ['int', 'bool'], result: 'bool' },
    ReadPower: { parameters: ['int'], result: 'string' },
    SetColor: { parameters: ['int', 'string'], result: 'bool' },
    ReadColor: { parameters: ['int'], result: 'string' },
    SetIntensity: { parameters: ['int', 'int'], result: 'bool' },
    ReadIntensity: { parameters: ['int'], result: 'string' },
    Close: { parameters: ['int'], result: 'bool' },
    Delay: { parameters: ['int'], result: 'void' },
  };
  const pcodeText = template.replaceAll('{{name}}', name).replaceAll('{{type}}', type).replaceAll('{{pin}}', String(pin));
  const procedures = {}, sourceMap = {}, exports = {};
  for (const [member, { parameters, result }] of Object.entries(methods)) {
    const label = `DEVICE_${member.toUpperCase()}`;
    exports[member] = label;
    procedures[label] = {
      name: `${id}.${member}`, params: parameters.map((_, index) => `ARG${index}`), locals: [],
      parameterTypes: parameters, returnType: result, visibility: 'public', typeArguments: [],
    };
  }
  let address = 0;
  const sourceLines = template.split(/\r?\n/);
  for (const [index, instruction] of pcodeText.split(/\r?\n/).entries()) {
    if (instruction && !instruction.endsWith(':')) sourceMap[address++] = {
      sourceFile, sourceLanguage: 'pcode', sourceLine: index + 1,
      sourceColumn: 1, sourceText: sourceLines[index], instruction,
    };
  }
  return createScalarLibrary({
    pcodeText,
    programMap: { abi: { id: 'pulse.scalar', version: 1 }, target: 'esp32', targets: ['esp32'],
      globals: [], procedures, sourceMap },
  }, { id, version: '0.2.0', exports });
}
