import net from 'node:net';
import dgram from 'node:dgram';
import { createDecipheriv } from 'node:crypto';

const LIMIT = 4096;

function boundedInteger(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${label}`);
  return value;
}

function bytes(hex) {
  if (typeof hex !== 'string' || hex.length > LIMIT * 2 || !/^(?:[0-9a-f]{2})*$/i.test(hex)) {
    throw new Error('Invalid or oversized hex bytes');
  }
  return Buffer.from(hex, 'hex');
}

export function createNetworkBindings(networkPeers = []) {
  if (!Array.isArray(networkPeers) || networkPeers.length > 8) throw new Error('Invalid network peer allowlist');
  const peers = new Set(networkPeers.map(peer => {
    if (net.isIP(peer?.ip) !== 4) throw new Error('Network peers require literal IPv4 addresses');
    return `${peer.ip}:${boundedInteger(peer.port, 1, 65535, 'peer port')}`;
  }));
  function validate(ip, port, hex, timeout, maxBytes) {
    if (!peers.has(`${ip}:${port}`)) throw new Error('Network peer is not allowed');
    boundedInteger(timeout, 1, 2000, 'network timeout');
    boundedInteger(maxBytes, 1, LIMIT, 'response limit');
    const payload = bytes(hex);
    if (!payload.length) throw new Error('Empty network request');
    return payload;
  }
  return {
    'host.bytes_crc32': hex => {
      let crc = 0xffffffff;
      for (const byte of bytes(hex)) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
      }
      return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
    },
    'host.bytes_aes_ecb_decrypt': (hex, keyHex) => {
      const key = bytes(keyHex), data = bytes(hex);
      if (key.length !== 16 || !data.length || data.length % 16) throw new Error('Invalid AES ECB key or ciphertext');
      const decipher = createDecipheriv('aes-128-ecb', key, null);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('hex');
    },
    'host.bytes_aes_gcm_decrypt': (hex, keyHex, nonceHex, aadHex, tagHex) => {
      const key = bytes(keyHex), nonce = bytes(nonceHex), tag = bytes(tagHex);
      if (key.length !== 16 || nonce.length !== 12 || tag.length !== 16) throw new Error('Invalid AES GCM key, nonce or tag');
      const decipher = createDecipheriv('aes-128-gcm', key, nonce);
      decipher.setAAD(bytes(aadHex));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(bytes(hex)), decipher.final()]).toString('hex');
    },
    'host.bytes_from_text': value => {
      if (typeof value !== 'string' || Buffer.byteLength(value) > LIMIT) throw new Error('Text byte limit exceeded');
      return Buffer.from(value, 'utf8').toString('hex');
    },
    'host.bytes_text': hex => new TextDecoder('utf-8', { fatal: true }).decode(bytes(hex)),
    'host.bytes_length': hex => bytes(hex).length,
    'host.bytes_get': (hex, index) => {
      const buffer = bytes(hex);
      return buffer[boundedInteger(index, 0, buffer.length - 1, 'byte index')];
    },
    'host.bytes_append': (hex, value) => {
      const buffer = bytes(hex);
      if (buffer.length >= LIMIT) throw new Error('Byte capacity exceeded');
      return buffer.toString('hex') + boundedInteger(value, 0, 255, 'byte').toString(16).padStart(2, '0');
    },
    'host.bytes_slice': (hex, start, length) => {
      const buffer = bytes(hex);
      boundedInteger(start, 0, buffer.length, 'byte offset');
      boundedInteger(length, 0, buffer.length - start, 'byte count');
      return buffer.subarray(start, start + length).toString('hex');
    },
    'host.bytes_join': (left, right) => {
      const first = bytes(left), second = bytes(right);
      if (first.length + second.length > LIMIT) throw new Error('Byte capacity exceeded');
      return first.toString('hex') + second.toString('hex');
    },
    'host.byte_xor': (left, right) =>
      boundedInteger(left, 0, 255, 'byte') ^ boundedInteger(right, 0, 255, 'byte'),
    'host.tcp_exchange': (ip, port, hex, prefixBytes, timeout, maxBytes, { signal, loadBytes }) => {
      const payload = validate(ip, port, hex, timeout, maxBytes);
      boundedInteger(prefixBytes, 1, 4, 'frame prefix size');
      return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        let buffer = Buffer.alloc(0);
        let expected;
        let settled = false;
        const finish = (error, value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal.removeEventListener('abort', abort);
          socket.destroy();
          if (error) reject(error); else resolve(value);
        };
        const abort = () => finish(new Error('TCP exchange cancelled'));
        const timer = setTimeout(() => finish(new Error('TCP exchange timeout')), timeout);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) { abort(); return; }
        socket.on('error', error => finish(error));
        socket.on('end', () => finish(new Error('Incomplete TCP frame')));
        socket.on('data', chunk => {
          if (buffer.length + chunk.length > maxBytes + prefixBytes) {
            finish(new Error('TCP response capacity exceeded')); return;
          }
          buffer = Buffer.concat([buffer, chunk]);
          if (expected === undefined && buffer.length >= prefixBytes) {
            expected = buffer.readUIntBE(0, prefixBytes);
            if (expected < 1 || expected > maxBytes) { finish(new Error('Invalid TCP frame length')); return; }
          }
          if (expected !== undefined && buffer.length >= expected + prefixBytes) {
            if (buffer.length !== expected + prefixBytes) finish(new Error('Unexpected bytes after TCP frame'));
            else {
              try { finish(null, loadBytes ? loadBytes(buffer.subarray(prefixBytes)) : buffer.toString('hex')); }
              catch (error) { finish(error); }
            }
          }
        });
        socket.connect(port, ip, () => socket.write(payload));
      });
    },
    'host.udp_exchange': (ip, port, hex, timeout, maxBytes, { signal }) => {
      const payload = validate(ip, port, hex, timeout, maxBytes);
      return new Promise((resolve, reject) => {
        const socket = dgram.createSocket('udp4');
        let settled = false;
        const finish = (error, value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal.removeEventListener('abort', abort);
          socket.close();
          if (error) reject(error); else resolve(value);
        };
        const abort = () => finish(new Error('UDP exchange cancelled'));
        const timer = setTimeout(() => finish(new Error('UDP exchange timeout')), timeout);
        signal.addEventListener('abort', abort, { once: true });
        socket.on('error', error => finish(error));
        socket.on('message', (message, peer) => {
          if (peer.address !== ip || peer.port !== port) return;
          if (!message.length || message.length > maxBytes) finish(new Error('UDP response capacity exceeded'));
          else finish(null, message.toString('hex'));
        });
        socket.bind(0, () => {
          if (signal.aborted) { abort(); return; }
          socket.send(payload, port, ip, error => { if (error) finish(error); });
        });
      });
    }
  };
}
