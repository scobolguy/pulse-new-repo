/**
 * Generic UPnP driver: SSDP discovery + best-effort SOAP control.
 * Control is only implemented for the two common on/off switch service types
 * (WeMo basicevent and the standard UPnP SwitchPower service). Everything else
 * (media renderers, routers, DLNA servers, etc.) is discovered as monitor-only.
 */
import dgram from 'node:dgram';
import { XMLParser } from 'fast-xml-parser';
import { normalizeId, getLanDiscoveryTarget } from '../utils.mjs';

const SSDP_MULTICAST_ADDRESS = '239.255.255.250';
const SSDP_MULTICAST_PORT = 1900;
const SEARCH_TARGETS = ['ssdp:all', 'upnp:rootdevice'];
const DESCRIPTION_FETCH_TIMEOUT_MS = 4000;

const SWITCH_SERVICE_HANDLERS = [
  {
    // Belkin WeMo switches/insight plugs.
    matches: (serviceType) => /:service:basicevent:/i.test(serviceType),
    getAction: 'GetBinaryState',
    setAction: 'SetBinaryState',
    setArgName: 'BinaryState',
    parseState: (value) => Number(value) === 1
  },
  {
    // Standard UPnP SwitchPower:1 service.
    matches: (serviceType) => /:service:switchpower:/i.test(serviceType),
    getAction: 'GetTarget',
    setAction: 'SetTarget',
    setArgName: 'newTargetValue',
    parseState: (value) => Number(value) === 1
  }
];

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function parseSsdpResponse(buffer) {
  const text = buffer.toString('utf8');
  const headers = {};
  for (const line of text.split(/\r\n/).slice(1)) {
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    headers[line.slice(0, separator).trim().toUpperCase()] = line.slice(separator + 1).trim();
  }
  return headers;
}

function ssdpSearch(searchTarget, timeoutMs) {
  return new Promise((resolve) => {
    const found = new Map();
    const { interfaceAddress } = getLanDiscoveryTarget();
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const request = Buffer.from(
      'M-SEARCH * HTTP/1.1\r\n'
      + `HOST: ${SSDP_MULTICAST_ADDRESS}:${SSDP_MULTICAST_PORT}\r\n`
      + 'MAN: "ssdp:discover"\r\n'
      + `MX: ${Math.max(1, Math.min(5, Math.round(timeoutMs / 1000)))}\r\n`
      + `ST: ${searchTarget}\r\n\r\n`
    );

    socket.on('message', (message) => {
      const headers = parseSsdpResponse(message);
      const usn = headers.USN || headers.LOCATION;
      const location = headers.LOCATION;
      if (!usn || !location || found.has(usn)) return;
      found.set(usn, { usn, location, server: headers.SERVER || '', st: headers.ST || searchTarget });
    });
    socket.on('error', () => { try { socket.close(); } catch { /* already closed */ } });

    // Binding to 0.0.0.0 on Windows sends the multicast request out the wrong
    // interface, so no replies ever arrive — bind + setMulticastInterface to
    // the active LAN address explicitly.
    socket.bind(0, interfaceAddress || undefined, () => {
      try {
        if (interfaceAddress) socket.setMulticastInterface(interfaceAddress);
        socket.send(request, SSDP_MULTICAST_PORT, SSDP_MULTICAST_ADDRESS);
      } catch { /* best effort */ }
    });

    setTimeout(() => {
      try { socket.close(); } catch { /* already closed */ }
      resolve(Array.from(found.values()));
    }, timeoutMs);
  });
}

async function fetchDeviceDescription(location) {
  const response = await fetch(location, { signal: AbortSignal.timeout(DESCRIPTION_FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Description fetch failed (${response.status})`);
  const xml = await response.text();
  const parsed = xmlParser.parse(xml);
  const device = parsed?.root?.device;
  if (!device) throw new Error('No <device> element in description XML');
  const baseUrl = new URL(location);
  const services = []
    .concat(device.serviceList?.service || [])
    .filter(Boolean)
    .map((service) => ({
      serviceType: String(service.serviceType || ''),
      controlUrl: new URL(String(service.controlURL || ''), baseUrl).toString()
    }));
  return {
    friendlyName: String(device.friendlyName || '').trim(),
    manufacturer: String(device.manufacturer || '').trim(),
    modelName: String(device.modelName || '').trim(),
    deviceType: String(device.deviceType || '').trim(),
    udn: String(device.UDN || '').trim(),
    host: baseUrl.hostname,
    presentationUrl: device.presentationURL ? new URL(String(device.presentationURL), baseUrl).toString() : '',
    services
  };
}

function findSwitchHandler(services) {
  for (const service of services) {
    const handler = SWITCH_SERVICE_HANDLERS.find((candidate) => candidate.matches(service.serviceType));
    if (handler) return { handler, service };
  }
  return null;
}

async function soapCall(controlUrl, serviceType, action, args = {}) {
  const argsXml = Object.entries(args).map(([key, value]) => `<${key}>${value}</${key}>`).join('');
  const body = '<?xml version="1.0" encoding="utf-8"?>'
    + '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">'
    + `<s:Body><u:${action} xmlns:u="${serviceType}">${argsXml}</u:${action}></s:Body></s:Envelope>`;
  const response = await fetch(controlUrl, {
    method: 'POST',
    headers: {
      'content-type': 'text/xml; charset="utf-8"',
      soapaction: `"${serviceType}#${action}"`
    },
    body,
    signal: AbortSignal.timeout(5000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`SOAP ${action} failed (${response.status}): ${text.slice(0, 200)}`);
  return xmlParser.parse(text);
}

export function createUpnpDriver({ devices, discoveryTimeoutMs }) {
  function upsert(description) {
    const id = `upnp:${description.udn || description.host}`;
    const switchInfo = findSwitchHandler(description.services);
    devices.set(normalizeId(id), {
      id,
      protocol: 'upnp',
      vendor: description.manufacturer || 'UPnP',
      name: description.friendlyName || `UPnP ${description.host}`,
      ip: description.host,
      port: 0,
      deviceType: description.deviceType || 'device',
      model: description.modelName || '',
      manageable: Boolean(switchInfo),
      managementReason: switchInfo ? '' : 'No SwitchPower/BasicEvent service exposed by this UPnP device',
      online: true,
      powerState: null,
      presentationUrl: description.presentationUrl || '',
      controlUrl: switchInfo?.service.controlUrl || '',
      controlServiceType: switchInfo?.service.serviceType || '',
      lastSeen: Date.now()
    });
  }

  async function discover(timeoutMs) {
    const responses = (await Promise.all(SEARCH_TARGETS.map((target) => ssdpSearch(target, timeoutMs)))).flat();
    const byLocation = new Map();
    for (const response of responses) byLocation.set(response.location, response);

    const descriptions = await Promise.allSettled(
      Array.from(byLocation.keys()).map((location) => fetchDeviceDescription(location))
    );
    const found = [];
    for (const result of descriptions) {
      if (result.status !== 'fulfilled') continue;
      upsert(result.value);
      found.push(result.value);
    }
    return found;
  }

  async function invoke(device, action) {
    if (!device.manageable || !device.controlUrl) {
      throw new Error(device.managementReason || 'This UPnP device does not support control');
    }
    const handler = SWITCH_SERVICE_HANDLERS.find((candidate) => candidate.matches(device.controlServiceType));
    if (!handler) throw new Error('No known control handler for this UPnP service');

    if (action === 'status') {
      const result = await soapCall(device.controlUrl, device.controlServiceType, handler.getAction);
      const body = result?.['s:Envelope']?.['s:Body'] || result?.['SOAP-ENV:Envelope']?.['SOAP-ENV:Body'];
      const responseNode = body?.[`u:${handler.getAction}Response`] || {};
      const rawState = responseNode.CurrentState ?? responseNode.RetTargetValue ?? responseNode.BinaryState;
      device.powerState = handler.parseState(rawState);
      return { power: device.powerState };
    }

    const desired = action === 'toggle' ? !device.powerState : action === 'on';
    await soapCall(device.controlUrl, device.controlServiceType, handler.setAction, {
      [handler.setArgName]: desired ? 1 : 0
    });
    device.powerState = desired;
    device.lastSeen = Date.now();
    return { power: desired };
  }

  return { discover, invoke };
}
