export const DEVICE_BINDINGS_VERSION = 1;

export const DEVICE_BINDINGS = Object.freeze({
  'device.clock': { arity: 0, args: [], result: 'integer' },
  'device.elapsed': { arity: 1, args: ['integer'], result: 'integer' },
  'device.gpio_read': { arity: 1, args: ['integer'], result: 'integer' },
  'device.dht_read': { arity: 1, args: ['integer'], result: 'boolean' },
  'device.dht_temperature': { arity: 0, args: [], result: 'string' },
  'device.dht_humidity': { arity: 0, args: [], result: 'string' },
  'device.state_get': { arity: 1, args: ['string'], result: 'integer' },
  'device.state_set': { arity: 2, args: ['string', 'integer'], result: 'integer' }
});
