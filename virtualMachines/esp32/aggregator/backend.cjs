// Node.js backend for aggregator: UDP discovery, API proxy, and service broker
// Run with: node backend.mjs

import dgram from 'dgram';
import express from 'express';
import cors from 'cors';

const UDP_PORT = 4210;
const HTTP_PORT = 4000;
const SERVICE_DESCRIBE_PATH = '/services/describe';

const discoveredNodes = new Map(); // mac -> { ip, lastSeen, details }
const serviceMap = {}; // serviceName -> [ { node, status, ... } ]

// UDP discovery
const udp = dgram.createSocket('udp4');
udp.on('message', async (msg, rinfo) => {
  const str = msg.toString();
  // Example: "ESP32-VM online: <MAC> IP: <IP>"
  const macMatch = str.match(/online: ([^ ]+)/);
  const ipMatch = str.match(/IP: ([^ ]+)/);
  if (macMatch && ipMatch) {
    const mac = macMatch[1];
    const ip = ipMatch[1];
    let node = discoveredNodes.get(mac) || { ip, lastSeen: 0, details: null };
    node.ip = ip;
    node.lastSeen = Date.now();
    // Fetch /status and cache details
    try {
      const res = await fetch(`http://${ip}:80/status`);
      if (res.ok) {
        const details = await res.json();
        node.details = details;
      } else {
        node.details = { error: `Status fetch failed: ${res.status}` };
      }
    } catch (e) {
      node.details = { error: `Status fetch error: ${e.toString()}` };
    }
    discoveredNodes.set(mac, node);
  }
});
udp.bind(UDP_PORT);

// Periodically clean up old nodes
setInterval(() => {
  const now = Date.now();
  for (const [mac, node] of discoveredNodes.entries()) {
    if (now - node.lastSeen > 10 * 60 * 1000) discoveredNodes.delete(mac);
  }
}, 60 * 1000);

// Periodically query /services/describe from all nodes
async function updateServiceMap() {
  for (const key in serviceMap) delete serviceMap[key];
  for (const { ip } of discoveredNodes.values()) {
    try {
      const res = await fetch(`http://${ip}:80${SERVICE_DESCRIBE_PATH}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.services) {
        for (const svc of data.services) {
          if (!serviceMap[svc.name]) serviceMap[svc.name] = [];
          serviceMap[svc.name].push({ node: ip, ...svc });
        }
      }
    } catch (e) { /* ignore */ }
  }
}
setInterval(updateServiceMap, 5000);

// Express API
const app = express();
app.use(cors());

app.get('/api/nodes', (req, res) => {
  res.json(Array.from(discoveredNodes.values()));
});

app.get('/api/services', (req, res) => {
  res.json(serviceMap);
});

// Service broker endpoint: find a free node for a service
app.get('/api/broker/:service', (req, res) => {
  const svc = req.params.service;
  const nodes = serviceMap[svc] || [];
  // Example: pick first node with status 'ready' or 'up'
  const free = nodes.find(n => n.status === 'ready' || n.status === 'up');
  if (free) res.json(free);
  else res.status(404).json({ error: 'No available node for service' });
});






// Proxy endpoint: forwards requests to device endpoints using a query parameter for the path
app.get('/api/proxy/:ip', async (req, res) => {
  const { ip } = req.params;
  const path = req.query.path || '/';
  try {
    const url = `http://${ip}:80${path}`;
    const deviceRes = await fetch(url);
    const contentType = deviceRes.headers.get('content-type') || '';
    res.status(deviceRes.status);
    // Always try to parse as JSON for /ffs/devices
    if (path === '/ffs/devices') {
      try {
        const data = await deviceRes.json();
        res.json(data);
      } catch (jsonErr) {
        const text = await deviceRes.text();
        console.log(`[Proxy Debug] ${url} /ffs/devices returned non-JSON: ${jsonErr}\n${text.substring(0, 500)}`);
        res.json({ error: 'Device did not return valid JSON', details: jsonErr.toString(), body: text.substring(0, 500) });
      }
      return;
    }
    // Normal handling for other endpoints
    if (contentType.includes('application/json')) {
      const data = await deviceRes.json();
      res.json(data);
    } else {
      const text = await deviceRes.text();
      // Log the non-JSON response for debugging
      console.log(`[Proxy Debug] ${url} returned non-JSON content-type (${contentType}):\n${text.substring(0, 500)}`);
      res.type(contentType).send(text);
    }
  } catch (e) {
    res.status(502).json({ error: 'Proxy fetch failed', details: e.toString() });
  }
});

app.listen(HTTP_PORT, () => {
  console.log(`Aggregator backend running on http://localhost:${HTTP_PORT}`);
});
