export function createByteBufferBindings(jsonPath) {
  const data = Buffer.alloc(4096);
  let active = false, capacity = 0, length = 0, generation = 0;
  const integer = (value, min, max) => {
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error('Invalid byte buffer integer');
    return value;
  };
  const valid = handle => {
    if (!active || handle !== generation) throw new Error('Invalid or released byte buffer handle');
  };
  const finish = (handle, text, consume = true) => {
    valid(handle);
    const value = text
      ? new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(data.subarray(0, length))
      : data.subarray(0, length).toString('hex');
    if (consume) active = false;
    return value;
  };
  return {
    'host.buffer_create': size => {
      integer(size, 0, 4096);
      if (active) throw new Error('Byte buffer already active');
      capacity = size; length = 0; active = true;
      generation = generation === 2147483647 ? 1 : generation + 1;
      return generation;
    },
    'host.buffer_append': (handle, byte) => {
      valid(handle); integer(byte, 0, 255);
      if (length >= capacity) throw new Error('Byte buffer capacity exceeded');
      data[length++] = byte;
      return handle;
    },
    'host.buffer_length': handle => { valid(handle); return length; },
    'host.buffer_get': (handle, index) => { valid(handle); return data[integer(index, 0, length - 1)]; },
    'host.buffer_set': (handle, index, byte) => {
      valid(handle); integer(index, 0, length - 1); integer(byte, 0, 255);
      data[index] = byte; return handle;
    },
    'host.buffer_hex': handle => finish(handle, false),
    'host.buffer_text': handle => finish(handle, true),
    ...(jsonPath ? {
      'host.buffer_json_path_text': (handle, path) => jsonPath(finish(handle, true, false), path, 'string'),
      'host.buffer_json_path_integer': (handle, path) => jsonPath(finish(handle, true, false), path, 'integer')
    } : {}),
    'host.buffer_release': handle => { valid(handle); active = false; return 0; }
  };
}
