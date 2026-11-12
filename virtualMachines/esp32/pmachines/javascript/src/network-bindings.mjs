import net from 'node:net';
import dgram from 'node:dgram';
import os from 'node:os';
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
  if (!Array.isArray(networkPeers) || networkPeers.length > 256) throw new Error('Invalid network peer allowlist');
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
  function localIpv4Subnets() {
    const subnets = [];
    for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
      for (const entry of addresses || []) {
        if (entry.family !== 'IPv4' && entry.family !== 4 || entry.internal || !entry.netmask) continue;
        const octets = value => value.split('.').map(part => Number(part));
        const address = octets(entry.address), mask = octets(entry.netmask);
        if (address.length !== 4 || mask.length !== 4 ||
            [...address, ...mask].some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
          continue;
        }
        const ip = address.reduce((value, part) => (value << 8) | part, 0) >>> 0;
        const netmask = mask.reduce((value, part) => (value << 8) | part, 0) >>> 0;
        const network = ip & netmask, broadcast = (network | (~netmask >>> 0)) >>> 0;
        const prefixLength = netmask.toString(2).split('1').length - 1;
        const dotted = value => [24, 16, 8, 0].map(shift => (value >>> shift) & 255).join('.');
        subnets.push({
          interface: name,
          address: entry.address,
          netmask: entry.netmask,
          prefixLength,
          network: dotted(network),
          broadcast: dotted(broadcast)
        });
      }
    }
    return JSON.stringify(subnets);
  }
  function discoverySubnets() {
    return JSON.parse(localIpv4Subnets()).filter(subnet =>
      subnet.prefixLength >= 16 && subnet.prefixLength <= 30 &&
      !/virtual|vmware|virtualbox|hyper-v|default switch/i.test(subnet.interface));
  }
  const discoveryAddresses = subnet => {
    const toNumber = value => value.split('.').reduce((result, part) => (result << 8) | Number(part), 0) >>> 0;
    const network = toNumber(subnet.network), broadcast = toNumber(subnet.broadcast);
    if (broadcast - network > 1024) throw new Error('Discovery subnet exceeds the 1024-address scan limit');
    return Array.from({ length: Math.max(0, broadcast - network - 1) },
      (_, index) => [24, 16, 8, 0].map(shift => ((network + index + 1) >>> shift) & 255).join('.'));
  };
  function kasaProbe(ip, timeoutMs = 150) {
    return new Promise(resolve => {
      const socket = dgram.createSocket('udp4');
      const request = Buffer.from('d0f281f88bff9af7d5ef94b6d1b4c09fec95e68fe187e8caf08bf68bf6', 'hex');
      let done = false;
      const finish = message => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        socket.close();
        resolve(message ? { kind: 'kasa', address: ip, port: 9999, responseHex: message.toString('hex') } : null);
      };
      const timer = setTimeout(() => finish(null), timeoutMs);
      socket.on('error', () => finish(null));
      socket.on('message', message => finish(message));
      socket.send(request, 9999, ip, error => { if (error) finish(null); });
    });
  }
  async function kasaDiscover() {
    const devices = [];
    for (const subnet of discoverySubnets()) {
      const addresses = discoveryAddresses(subnet);
      for (let index = 0; index < addresses.length; index += 24) {
        const results = await Promise.all(addresses.slice(index, index + 24).map(address => kasaProbe(address)));
        devices.push(...results.filter(Boolean));
      }
    }
    return JSON.stringify(devices);
  }
  function cameraDiscover() {
    const probe = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope"
 xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing"
 xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"
 xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
<e:Header><w:MessageID>uuid:${Date.now()}-${Math.random()}</w:MessageID>
<w:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>
<w:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action></e:Header>
<e:Body><d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe></e:Body></e:Envelope>`);
    const devices = [];
    const onvif = new Promise(resolve => {
      const socket = dgram.createSocket('udp4');
      const timer = setTimeout(() => {
        socket.close();
        resolve(JSON.stringify(devices));
      }, 2000);
      socket.on('error', () => {
        clearTimeout(timer);
        socket.close();
        resolve(JSON.stringify(devices));
      });
      socket.on('message', (message, peer) => {
        devices.push({ kind: 'camera', protocol: 'onvif', address: peer.address, port: peer.port || 3702,
          response: message.toString('utf8').slice(0, 2048) });
      });
      socket.bind(0, discoverySubnets()[0]?.address || '0.0.0.0', () => {
        socket.addMembership('239.255.255.250');
        socket.send(probe, 3702, '239.255.255.250');
      });
    });
    const rtsp = async () => {
      const results = [];
      for (const subnet of discoverySubnets()) {
        const addresses = discoveryAddresses(subnet);
        for (let index = 0; index < addresses.length; index += 24) {
          await Promise.all(addresses.slice(index, index + 24).flatMap(address =>
            [554, 2020].map(port => new Promise(resolve => {
              const socket = net.createConnection({ host: address, port });
              let response = '', settled = false;
              const finish = () => {
                if (settled) return;
                settled = true;
                socket.destroy();
                if (/^RTSP\/1\.[01]/m.test(response)) {
                  devices.push({ kind: 'camera', protocol: 'rtsp', address, port });
                }
                resolve();
              };
              socket.setTimeout(250, finish);
              socket.once('error', finish);
              socket.once('connect', () => socket.write(
                `OPTIONS rtsp://${address}:${port}/ RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: PulseDiscovery\r\n\r\n`
              ));
              socket.on('data', chunk => { response += chunk.toString('ascii'); finish(); });
            }))
          ));
        }
      }
      return results;
    };
    return Promise.race([
      Promise.all([onvif, rtsp()]).then(() => JSON.stringify(devices)),
      new Promise(resolve => setTimeout(() => resolve(JSON.stringify(devices)), 15000))
    ]);
  }
  async function filesystemPost(ip, port, route, body, timeout, { signal }) {
    if (!peers.has(`${ip}:${port}`)) throw new Error('Network peer is not allowed');
    boundedInteger(port, 1, 65535, 'filesystem peer port');
    boundedInteger(timeout, 1, 2000, 'filesystem request timeout');
    if (net.isIP(ip) !== 4 || typeof route !== 'string' ||
        !/^\/[A-Za-z0-9/_-]{1,127}$/.test(route) || route.includes('..')) {
      throw new Error('Invalid filesystem service route');
    }
    if (typeof body !== 'string' || Buffer.byteLength(body) > 1024) {
      throw new Error('Filesystem request body capacity exceeded');
    }
    const response = await fetch(`http://${ip}:${port}${route}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', connection: 'close' },
      body,
      signal: AbortSignal.any([signal, AbortSignal.timeout(timeout)])
    });
    const responseBody = await response.text();
    if (Buffer.byteLength(responseBody) > 2048) throw new Error('Filesystem response capacity exceeded');
    return JSON.stringify({ status: response.status, body: responseBody });
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
    'host.filesystem_post': filesystemPost,
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
    ,
    'host.local_ipv4_subnets': localIpv4Subnets
    ,
    'host.kasa_discover': kasaDiscover,
    'host.camera_discover': cameraDiscover
  };
}
