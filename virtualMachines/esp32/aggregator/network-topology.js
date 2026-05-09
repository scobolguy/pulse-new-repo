// network-topology.js
// Fetches ESP32 nodes and their services/devices, outputs a Mermaid diagram


import fetch from 'node-fetch';

let AGGREGATOR_URL = 'http://localhost:4000/api/nodes';
if (typeof window !== 'undefined' && window.location) {
  const { hostname } = window.location;
  if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
    AGGREGATOR_URL = `http://${hostname}:4000/api/nodes`;
  }
}

const SERVICE_PATHS = ['/services/describe', '/status'];


async function getNodes() {
  const res = await fetch(AGGREGATOR_URL);
  if (!res.ok) throw new Error('Failed to fetch nodes');
  return await res.json();
}


async function getNodeDetails(ip) {
  let details = null;
  for (const path of SERVICE_PATHS) {
    try {
      const res = await fetch(`http://${ip}:80${path}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (data && (Array.isArray(data.services) || Array.isArray(data.devices) || data.status || data.state)) {
        details = data;
        break;
      }
    } catch {}
  }
  // Try /ffs/devices for device info
  try {
    const res = await fetch(`http://${ip}:80/ffs/devices`);
    if (res.ok) {
      const devices = await res.json();
      if (Array.isArray(devices)) {
        if (!details) details = {};
        details.devices = devices;
      }
    }
  } catch {}
  return details;
}

function buildMermaid(topology) {
  let diagram = 'graph TD\n';
  for (const node of topology) {
    const nodeId = node.ip.replace(/\./g, '_');
    let label = node.ip;
    if (node.details) {
      // Prefer nodeName and hardware if available
      if (node.details.nodeName && node.details.hardware) {
        label = `${node.details.nodeName}\\n(${node.details.hardware})\\n${node.ip}`;
      } else if (node.details.nodeName) {
        label = `${node.details.nodeName}\\n${node.ip}`;
      }
    }
    diagram += `  N_${nodeId}([${label}])\n`;
    if (node.details) {
      // If services is an array of strings (from /status)
      if (Array.isArray(node.details.services) && typeof node.details.services[0] === 'string') {
        for (const svc of node.details.services) {
          const svcId = `${nodeId}_svc_${svc}`.replace(/\W/g, '');
          diagram += `  N_${nodeId} --> S_${svcId}([Service: ${svc}])\n`;
        }
      }
      // If services is an array of objects (from /services/describe)
      if (Array.isArray(node.details.services) && typeof node.details.services[0] === 'object') {
        for (const svc of node.details.services) {
          const svcId = `${nodeId}_svc_${svc.name}`.replace(/\W/g, '');
          diagram += `  N_${nodeId} --> S_${svcId}([Service: ${svc.name}])\n`;
        }
      }
      if (Array.isArray(node.details.devices)) {
        for (const dev of node.details.devices) {
          const devId = `${nodeId}_dev_${dev.name}`.replace(/\W/g, '');
          diagram += `  N_${nodeId} --> D_${devId}([Device: ${dev.name}])\n`;
        }
      }
    }
  }
  return diagram;
}

const nodes = await getNodes();
const topology = [];
for (const node of nodes) {
  const details = await getNodeDetails(node.ip);
  topology.push({ ...node, details });
}
const mermaid = buildMermaid(topology);
console.log('Mermaid diagram:');
console.log('```mermaid');
console.log(mermaid);
console.log('```');
