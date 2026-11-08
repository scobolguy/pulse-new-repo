export const DEVICE_BINDINGS_VERSION = 1;

export const DEVICE_BINDINGS = Object.freeze({
  'device.clock': { arity: 0, args: [], result: 'integer' },
  'device.elapsed': { arity: 1, args: ['integer'], result: 'integer' },
  'device.gpio_read': { arity: 1, args: ['integer'], result: 'integer' },
  'device.dht_read': { arity: 1, args: ['integer'], result: 'boolean' },
  'device.dht_temperature': { arity: 0, args: [], result: 'string' },
  'device.dht_humidity': { arity: 0, args: [], result: 'string' },
  'device.hal_read': { arity: 1, args: ['string'], result: 'integer' },
  'device.hal_write': { arity: 2, args: ['string', 'integer'], result: 'integer' },
  'device.hal_pwm': { arity: 2, args: ['string', 'integer'], result: 'integer' },
  'device.hal_dht_read': { arity: 1, args: ['string'], result: 'integer' },
  'device.hal_temperature': { arity: 0, args: [], result: 'integer' },
  'device.hal_humidity': { arity: 0, args: [], result: 'integer' },
  'device.hal_event': { arity: 5, args: ['string', 'string', 'integer', 'integer', 'integer'], result: 'integer' },
  'device.state_get': { arity: 1, args: ['string'], result: 'integer' },
  'device.state_set': { arity: 2, args: ['string', 'integer'], result: 'integer' }
});
