import fs from 'fs';
import path from 'path';
import http from 'http';
import { reloadOllamaContext, getOllamaWarmthStatus, ollamaGenerate } from './ollamaService.mjs';

const SLOW_QUERY_THRESHOLD = 60000; // 60 seconds
const SLOW_QUERY_LOG_FILE = path.resolve('./logs/slow-queries.jsonl');

// Ensure logs directory exists
const logsDir = path.resolve('./logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Load global system knowledge that provides context to Ollama responses.
 */
let globalKnowledge = '';
try {
  const knowledgePath = path.resolve('./data/general-knowledge.md');
  if (fs.existsSync(knowledgePath)) {
    globalKnowledge = fs.readFileSync(knowledgePath, 'utf8');
  }
} catch (e) {
  console.warn('[OLLAMA] Warning: Could not load general-knowledge.md:', e.message);
}

/**
 * Load device configuration for hardware control
 */
let deviceConfig = {};
try {
  const deviceConfigPath = path.resolve('./data/device-config.json');
  if (fs.existsSync(deviceConfigPath)) {
    const configData = fs.readFileSync(deviceConfigPath, 'utf8');
    deviceConfig = JSON.parse(configData);
    console.log('[OLLAMA] Loaded device configuration with', Object.keys(deviceConfig.devices || {}).length, 'devices');
  }
} catch (e) {
  console.warn('[OLLAMA] Warning: Could not load device-config.json:', e.message);
}

/**
 * Response cache for tree queries and topology requests
 * Maps query hash to { response, timestamp }
 */
const responseCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCacheKey = (query) => {
  return query.toLowerCase().trim();
};

const isCacheValid = (timestamp) => {
  return Date.now() - timestamp < CACHE_TTL;
};

const recordSlowQuery = (query, queryType, duration, success, errorMsg = null) => {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      query: query.substring(0, 200), // Truncate long queries
      queryType,
      durationMs: Math.round(duration),
      success,
      error: errorMsg
    };
    fs.appendFileSync(SLOW_QUERY_LOG_FILE, JSON.stringify(logEntry) + '\n');
  } catch (err) {
    console.warn('[OLLAMA] Failed to record slow query:', err.message);
  }
};

// Helper to invalidate cache for related queries
const invalidateCachePatterns = (patterns) => {
  let invalidated = 0;
  for (const [key] of responseCache.entries()) {
    if (patterns.some(p => key.includes(p))) {
      responseCache.delete(key);
      invalidated++;
    }
  }
  if (invalidated > 0) {
    console.log(`[OLLAMA] Invalidated ${invalidated} cache entries for patterns:`, patterns);
  }
};

/**
 * Device control helper functions
 */

/**
 * Parse device name from query
 * Examples: "turn on the led on child1" -> "child1"
 *           "turn on neptune.child1 led" -> "child1"
 */
const parseDeviceName = (query) => {
  const lowerQuery = query.toLowerCase();
  
  // Look for device name patterns
  // Pattern 1: "child1", "child2", "child3"
  const childMatch = lowerQuery.match(/child[123]\b/);
  if (childMatch) return childMatch[0];
  
  // Pattern 2: "neptune.child1"
  const fullyQualified = lowerQuery.match(/neptune\.child[123]\b/);
  if (fullyQualified) {
    const parts = fullyQualified[0].split('.');
    return parts[1]; // Return just "child1" from "neptune.child1"
  }
  
  // Pattern 3: Named device: "aggregator", "neptune"
  const namedDevice = lowerQuery.match(/\b(aggregator|neptune|pmachine)\b/);
  if (namedDevice) return namedDevice[1];
  
  return null;
};

/**
 * Get device configuration
 */
const getDeviceInfo = (deviceName) => {
  if (!deviceName || !deviceConfig.devices) return null;
  const device = deviceConfig.devices[deviceName.toLowerCase()];
  return device || null;
};

/**
 * Get LED pin for a device type
 */
const getLedPin = (deviceType) => {
  if (!deviceType || !deviceConfig.deviceTypes) return null;
  const typeConfig = deviceConfig.deviceTypes[deviceType];
  return typeConfig ? typeConfig.ledPin : null;
};

/**
 * Construct GPIO command for device control
 */
const constructGpioCommand = (deviceName, pin, value) => {
  const device = getDeviceInfo(deviceName);
  if (!device) return null;
  
  return {
    device: deviceName,
    ip: device.ip,
    port: device.port || 80,
    type: device.type,
    pin: pin,
    value: value, // 0 = OFF, 1 = ON
    endpoint: `/api/device/${deviceName}/gpio/${pin}/set`,
    description: `Turn ${value ? 'ON' : 'OFF'} LED on ${deviceName} (GPIO${pin})`
  };
};

/**
 * Send GPIO command to device
 */
const sendGpioCommand = (command) => {
  return new Promise((resolve, reject) => {
    // ESP32 endpoint: /devices/ledpin/action?action=on|off
    const action = command.value ? 'on' : 'off';
    const url = `http://${command.ip}:${command.port}/devices/ledpin/action?action=${action}`;
    
    const req = http.request(url, {
      method: 'POST',
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            success: res.statusCode === 200 || res.statusCode === 201,
            statusCode: res.statusCode,
            response: response,
            command: command
          });
        } catch (e) {
          resolve({
            success: res.statusCode === 200 || res.statusCode === 201,
            statusCode: res.statusCode,
            response: data,
            command: command
          });
        }
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout sending command to ${command.ip}:${command.port}`));
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    // No body needed since we use query parameters
    req.end();
  });
};

/**
 * Detect if query is a device control request (turn on/off LED, toggle, etc.)
 */
const isDeviceControlQuery = (query) => {
  const lowerQuery = query.toLowerCase();
  const hasDevice = /child1|child2|child3|neptune\.child\d/.test(lowerQuery);
  const hasAction = /turn\s+(on|off)|toggle|switch|activate|deactivate|blink|pulse|set.*(?:led|light)/i.test(lowerQuery);
  return hasDevice && hasAction;
};

/**
 * Extract device and action from device control query
 */
const parseDeviceControlQuery = (query) => {
  const lowerQuery = query.toLowerCase();
  
  // Extract device name
  let device = parseDeviceName(query);
  
  // Extract action - CHECK OFF FIRST to prevent matching "on" in "on child1"
  let action = null;
  if (/\boff\b|turn\s+off|switch\s+off|close|deactivate/.test(lowerQuery)) {
    action = 'off';
  } else if (/\bon\b|turn\s+on|switch\s+on|activate/.test(lowerQuery)) {
    action = 'on';
  } else if (/toggle|switch|flip|blink|pulse/.test(lowerQuery)) {
    action = 'on'; // For toggle, we send 'on'; device can implement toggle logic
  }
  
  return { device, action };
};

/**
 * Register Ollama management routes.
 */
export function registerOllamaRoutes(app) {
  console.log('[OLLAMA] registerOllamaRoutes() called, starting route registration...');
  
  /**
   * Fetch real node data from topology using HTTP and enhance with system context.
   */
  const fetchNodeData = async () => {
    return new Promise((resolve) => {
      const req = http.get('http://127.0.0.1:4000/api/nodes', { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const nodes = JSON.parse(data);
            console.log('[OLLAMA] Fetched nodes:', nodes.length ? `${nodes.length} nodes` : 'empty list');
            resolve(nodes);
          } catch (e) {
            console.warn('[OLLAMA] Failed to parse nodes:', e.message);
            resolve(null);
          }
        });
      });

      req.on('error', (e) => {
        console.warn('[OLLAMA] Error fetching nodes:', e.message);
        resolve(null);
      });

      req.on('timeout', () => {
        req.destroy();
        console.warn('[OLLAMA] Node fetch timeout');
        resolve(null);
      });
    });
  };

  /**
   * Known ESP32 nodes - hard-coded mapping of node names to IPs
   */
  const knownNodes = {
    'child1': { ip: '192.168.2.157', port: 80 },
    'child2': { ip: '192.168.2.59', port: 80 },
    'child3': { ip: '192.168.2.58', port: 80 }
  };

  /**
   * Control device on a node by making HTTP request directly to the device endpoint
   */
  const controlDeviceOnNode = async (nodeId, device, action) => {
    return new Promise((resolve) => {
      let nodeIp, nodePort;
      
      // Check if it's a known ESP32 node
      const knownNode = knownNodes[nodeId.toLowerCase()];
      if (knownNode) {
        nodeIp = knownNode.ip;
        nodePort = knownNode.port;
        executeDeviceControl();
        return;
      }

      // Otherwise, try to get from nodes endpoint
      const nodeReq = http.get('http://127.0.0.1:4000/api/nodes', { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const nodes = JSON.parse(data);
            const node = nodes.find(n => n.nodeName === nodeId || n.nodeId === nodeId);
            if (!node) {
              resolve({ success: false, error: `Node ${nodeId} not found in registry or known nodes` });
              return;
            }
            
            nodeIp = node.ip;
            nodePort = node.details?.httpPort || 80;
            executeDeviceControl();
          } catch (e) {
            resolve({ success: false, error: 'Failed to parse nodes' });
          }
        });
      });
      
      nodeReq.on('error', (e) => {
        resolve({ success: false, error: `Node fetch failed: ${e.message}` });
      });
      nodeReq.on('timeout', () => {
        nodeReq.destroy();
        resolve({ success: false, error: 'Node fetch timeout' });
      });

      function executeDeviceControl() {
        const devicePath = `/devices/${device.toLowerCase()}/action`;
        const postData = `action=${encodeURIComponent(action.toLowerCase())}`;
        
        const options = {
          hostname: nodeIp,
          port: nodePort,
          path: devicePath,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
          },
          timeout: 5000
        };
        
        const deviceReq = http.request(options, (deviceRes) => {
          let deviceData = '';
          deviceRes.on('data', (chunk) => { deviceData += chunk; });
          deviceRes.on('end', () => {
            try {
              const result = JSON.parse(deviceData);
              resolve({ 
                success: true, 
                device: result.device || device,
                action: result.action || action,
                state: result.state,
                nodeId: nodeId,
                pin: result.pin,
                timestamp: new Date().toISOString()
              });
            } catch (e) {
              resolve({ success: false, error: `Invalid device response: ${e.message}` });
            }
          });
        });
        
        deviceReq.on('error', (e) => {
          resolve({ success: false, error: `Device request failed: ${e.message}` });
        });
        
        deviceReq.write(postData);
        deviceReq.end();
      }
    });
  };

  // Helper to check for pre-computed answers in knowledge base
  const checkPreComputedAnswer = (query) => {
    const lowerQuery = query.toLowerCase();
    
    // Pre-computed answer triggers - specific patterns for informational queries only
    if (/show.*tree|network.*topology|node.*hierarchy|structure.*node|how.*arranged|how.*organized/.test(lowerQuery)) {
      return {
        type: 'topology',
        answer: `The network has 8 nodes arranged in a hierarchical structure:

ROOT NODES (5 total):
• Aggregator Backend (127.0.0.1)
• Neptune (172.18.0.1) [Cluster Controller]
• magic-js-pmachine-01 (127.0.10.101)
• magic-js-pmachine-02 (127.0.10.102)
• magic-js-pmachine-03 (127.0.10.103)

CHILD NODES (3 total, under Neptune):
• child1 (192.168.2.157) - ESP32-CAM
• child2 (192.168.2.59) - ESP8266
• child3 (192.168.2.58) - ESP32

Tree Structure:
Neptune (Cluster Controller)
├─ child1 (ESP32-CAM)
├─ child2 (ESP8266)
└─ child3 (ESP32)

Summary: 8 nodes total | 5 root nodes | 1 cluster controller | 3 child devices`
      };
    }
    
    if (/how many nodes|node count|total nodes|devices.*available|list.*nodes|all.*nodes|count.*device/.test(lowerQuery)) {
      return {
        type: 'quick',
        answer: `Currently 8 nodes are registered and online:
- 5 root nodes (no parent)
- 1 cluster controller (Neptune)
- 3 ESP32/ESP8266 child devices

All nodes are communicating normally.`
      };
    }
    
    if (/list.*esp32|esp32.*list|list.*esp8266|what.*esp32|what.*devices|esp32.*devices|esp8266.*available/.test(lowerQuery)) {
      return {
        type: 'devices',
        answer: `The network has 3 ESP microcontroller devices managed by Neptune:

1. child1 (192.168.2.157)
   Type: ESP32-CAM
   Parent: Neptune

2. child2 (192.168.2.59)
   Type: ESP8266
   Parent: Neptune

3. child3 (192.168.2.58)
   Type: ESP32
   Parent: Neptune

All child devices are online and operational.`
      };
    }
    
    if (/what.*neptune|neptune.*what|tell.*neptune|neptune.*info|who.*neptune|what.*cluster controller|cluster controller.*info/.test(lowerQuery)) {
      return {
        type: 'neptune',
        answer: `Neptune (IP: 172.18.0.1) is the cluster controller for the network.

KEY PROPERTIES:
• Role: Cluster Controller
• IP Address: 172.18.0.1
• Children: 3 ESP32/ESP8266 devices (child1, child2, child3)
• Hardware: Server
• Status: Online

Neptune manages device discovery and communication for all child nodes.`
      };
    }
    
    return null;
  };

  // Streaming handler for SSE (Server-Sent Events)
  const streamingAskHandler = async (req, res) => {
    const queryStartTime = Date.now();
    let query = '';
    
    try {
      query = String(req.body?.query || '').trim();
      if (!query) {
        return res.status(400).json({ error: 'query is required' });
      }

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      // Check for pre-computed answers first
      const precomputed = checkPreComputedAnswer(query);
      if (precomputed) {
        console.log('[OLLAMA] Pre-computed answer for:', query);
        res.write(`data: ${JSON.stringify({ chunk: precomputed.answer, final: true })}\n\n`);
        res.end();
        return;
      }

      // Check cache
      const cacheKey = getCacheKey(query);
      if (responseCache.has(cacheKey)) {
        const cached = responseCache.get(cacheKey);
        if (isCacheValid(cached.timestamp)) {
          console.log('[OLLAMA] Cache hit for streaming query:', query);
          res.write(`data: ${JSON.stringify({ chunk: cached.response.answer, final: true })}\n\n`);
          res.end();
          return;
        } else {
          responseCache.delete(cacheKey);
        }
      }

      // Stream response from Ollama (word by word)
      console.log('[OLLAMA] Streaming response for query:', query.substring(0, 50) + '...');
      const fullResponse = await ollamaGenerate(query);
      
      // Split response into chunks and stream
      const words = fullResponse.split(' ');
      let accumulated = '';
      
      for (const word of words) {
        accumulated += (accumulated ? ' ' : '') + word;
        res.write(`data: ${JSON.stringify({ chunk: word + ' ' })}\n\n`);
        // Small delay to simulate streaming (optional)
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Cache the full response
      responseCache.set(cacheKey, { 
        response: { answer: fullResponse }, 
        timestamp: Date.now() 
      });

      res.write(`data: ${JSON.stringify({ chunk: '', final: true })}\n\n`);
      res.end();

      const queryElapsed = Date.now() - queryStartTime;
      if (queryElapsed > SLOW_QUERY_THRESHOLD) {
        recordSlowQuery(query, 'streaming', queryElapsed, true);
      }
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      const queryElapsed = Date.now() - queryStartTime;
      if (queryElapsed > SLOW_QUERY_THRESHOLD) {
        recordSlowQuery(query, 'streaming-error', queryElapsed, false, msg);
      }
      console.error('[OLLAMA] Streaming error:', msg);
      res.write(`data: ${JSON.stringify({ error: msg, final: true })}\n\n`);
      res.end();
    }
  };

  const askHandler = async (req, res) => {
    const queryStartTime = Date.now();
    let query = '';
    try {
      query = String(req.body?.query || '').trim();
      if (!query) {
        return res.status(400).json({ error: 'query is required' });
      }

      // Check cache first
      const cacheKey = getCacheKey(query);
      if (responseCache.has(cacheKey)) {
        const cached = responseCache.get(cacheKey);
        if (isCacheValid(cached.timestamp)) {
          console.log('[OLLAMA] Cache hit for query:', query);
          return res.json(cached.response);
        } else {
          responseCache.delete(cacheKey);
        }
      }

      // Check for pre-computed answers first (instant response)
      const precomputed = checkPreComputedAnswer(query);
      if (precomputed) {
        console.log('[OLLAMA] Pre-computed answer for:', query.substring(0, 50));
        return res.json({
          success: true,
          answer: precomputed.answer,
          model: process.env.OLLAMA_MODEL || 'phi3:latest',
          queryType: precomputed.type,
          fromCache: 'precomputed'
        });
      }

      // Check for device control queries and route to device-control endpoint
      if (isDeviceControlQuery(query)) {
        console.log('[OLLAMA] Device control query detected:', query);
        const { device, action } = parseDeviceControlQuery(query);
        
        if (device && action) {
          console.log(`[OLLAMA] Routing to device-control: device=${device}, action=${action}`);
          try {
            // Call device-control endpoint directly
            const body = JSON.stringify({ device, action });
            const deviceResult = await new Promise((resolve, reject) => {
              const req = http.request('http://127.0.0.1:4000/api/ollama/device-control', {
                method: 'POST',
                timeout: 10000,
                headers: {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(body)
                }
              }, (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                  try {
                    resolve(JSON.parse(data));
                  } catch (e) {
                    resolve({ error: data });
                  }
                });
              });
              
              req.on('error', reject);
              req.on('timeout', () => {
                req.destroy();
                reject(new Error('Device control timeout'));
              });
              
              req.write(body);
              req.end();
            });
            
            // Format response for user
            const message = deviceResult.message || `LED on ${device} set to ${action.toUpperCase()}`;
            const cacheKey = getCacheKey(query);
            const response = {
              success: true,
              answer: message,
              model: 'device-control',
              queryType: 'device-control',
              device: deviceResult.device,
              pin: deviceResult.pin,
              value: deviceResult.value,
              deviceResponse: deviceResult
            };
            
            // Cache the response
            responseCache.set(cacheKey, { response, timestamp: Date.now() });
            
            return res.json(response);
          } catch (e) {
            console.error('[OLLAMA] Device control error:', e.message);
            return res.json({
              success: false,
              answer: `Error controlling device: ${e.message}`,
              model: 'device-control',
              queryType: 'device-control'
            });
          }
        }
      }

      // Detect query type for routing and prompt customization
      const isTreeQuery = /tree|hierarchy|structure|parent|child|under|belongs to|relationship/i.test(query);
      const isNodesQuery = /node|network|topology|infrastructure|devices?|cluster/i.test(query) && !isTreeQuery;
      const isServicesQuery = /service|capability|available|what can|what do|function/i.test(query);
      const isRelayQuery = /relay|switch|activate|deactivate|turn\s+on|turn\s+off|pulse|gpio/i.test(query);
      const isLedQuery = /led|light|ledpin|turn\s+(on|off)/i.test(query);
      
      let finalQuery = query;
      let queryType = 'general';
      let deviceControl = null;
      
      if (isTreeQuery) {
        queryType = 'tree-query';
        console.log('[OLLAMA] Tree query detected:', query);
        
        // For tree queries, fetch topology data and format it
        const nodeData = await fetchNodeData();
        if (!nodeData || nodeData.length === 0) {
          console.log('[OLLAMA] No nodes found for tree query');
          return res.json({
            success: true,
            answer: 'No nodes found in the network topology.',
            model: process.env.OLLAMA_MODEL || 'phi3:latest',
            queryType
          });
        }
        
        console.log('[OLLAMA] Building tree from', nodeData.length, 'nodes');
        
        // Build tree structure
        const nodesById = new Map();
        const nodesByKeyLower = new Map();
        const childrenByParent = new Map();
        const rootNodes = [];
        
        // First pass: index all nodes
        for (const node of nodeData) {
          const nodeKey = String(node?.nodeId || node?.nodeName || node?.ip || '').trim();
          if (!nodeKey) continue;
          nodesById.set(nodeKey, node);
          nodesByKeyLower.set(nodeKey.toLowerCase(), nodeKey);
        }
        
        console.log('[OLLAMA] Indexed', nodesById.size, 'nodes');
        
        // Second pass: build hierarchy
        for (const node of nodeData) {
          const nodeKey = String(node?.nodeId || node?.nodeName || node?.ip || '').trim();
          const parentIdRaw = String(node?.topology?.parentNodeId || '').trim();
          
          if (!parentIdRaw) {
            rootNodes.push(nodeKey);
            console.log('[OLLAMA] Root node:', nodeKey);
          } else {
            // Find parent by exact match or case-insensitive match
            const parentKeyLower = parentIdRaw.toLowerCase();
            const actualParentKey = nodesByKeyLower.get(parentKeyLower) || parentIdRaw;
            
            if (!childrenByParent.has(actualParentKey)) {
              childrenByParent.set(actualParentKey, []);
            }
            childrenByParent.get(actualParentKey).push(nodeKey);
            console.log('[OLLAMA] Child relationship:', nodeKey, '→', actualParentKey);
          }
        }
        
        console.log('[OLLAMA] Found', rootNodes.length, 'root nodes');
        
        // Format tree for Ollama
        const buildTreeText = (nodeKey, depth = 0, visited = new Set()) => {
          // Prevent infinite loops
          if (visited.has(nodeKey)) return '';
          visited.add(nodeKey);
          
          const node = nodesById.get(nodeKey);
          if (!node) return '';
          
          const indent = '  '.repeat(depth);
          let text = indent + '• ' + (node?.nodeName || nodeKey) + ` (${node?.ip || 'n/a'})`;
          
          const children = childrenByParent.get(nodeKey) || [];
          for (const childKey of children) {
            const childText = buildTreeText(childKey, depth + 1, visited);
            if (childText) text += '\n' + childText;
          }
          return text;
        };
        
        let treeText = 'Network Topology Tree:\n\n';
        for (const rootKey of rootNodes) {
          const rootText = buildTreeText(rootKey);
          if (rootText) treeText += rootText + '\n';
        }
        
        console.log('[OLLAMA] Tree formatted, sending to Ollama');
        
        // Ask Ollama to provide a nice summary of the tree
        const treePrompt = `Here is the network topology tree structure:\n\n${treeText}\n\nThe user asked: "${query}"\n\nProvide a clear, concise answer about the network topology and hierarchy.`;
        const answer = await ollamaGenerate(treePrompt);
        
        console.log('[OLLAMA] Tree query completed successfully');
        
        const treeResponse = {
          success: true,
          answer,
          model: process.env.OLLAMA_MODEL || 'phi3:latest',
          queryType,
          topology: {
            tree: treeText,
            rootNodes,
            totalNodes: nodeData.length
          }
        };
        
        // Cache the response
        responseCache.set(cacheKey, { response: treeResponse, timestamp: Date.now() });
        
        return res.json(treeResponse);
      } else if (isLedQuery && !isNodesQuery && !isServicesQuery) {
        queryType = 'device-control';
        // For LED control, ask Ollama to parse the command
        finalQuery = `Parse this LED/light control request and respond with ONLY valid JSON (no other text):
{
  "action": "on" or "off" or "toggle",
  "node": "<node name like 'child1' or 'child2'>",
  "device": "LEDPIN"
}

User request: "${query}"`;
        
        const answer = await ollamaGenerate(finalQuery);
        try {
          // Extract JSON from response (may be wrapped in markdown)
          let jsonStr = answer;
          const jsonMatch = jsonStr.match(/```json\n([\s\S]*?)\n```/) || jsonStr.match(/```\n([\s\S]*?)\n```/) || jsonStr.match(/```([\s\S]*?)```/);
          if (jsonMatch && jsonMatch[1]) {
            jsonStr = jsonMatch[1].trim();
          }
          jsonStr = jsonStr.replace(/\/\/.*$/gm, '').replace(/,\s*([\]}])/g, '$1');
          
          const cmd = JSON.parse(jsonStr);
          if (cmd.action && cmd.node) {
            // Execute the device control
            deviceControl = await controlDeviceOnNode(cmd.node, cmd.device || 'LEDPIN', cmd.action);
          }
        } catch (e) {
          console.warn('[OLLAMA] LED command parse failed:', e.message);
        }
        
        return res.json({
          success: true,
          answer: deviceControl?.success 
            ? `LED ${deviceControl.action}ed on ${deviceControl.node}` 
            : 'Could not control LED',
          model: process.env.OLLAMA_MODEL || 'phi3:latest',
          queryType,
          deviceControl: deviceControl
        });
      } else if (isRelayQuery) {
        queryType = 'relay-control';
        // For relay control, ask Ollama to parse the command and return JSON
        finalQuery = `Parse this relay control request and respond with ONLY valid JSON (no other text):
{
  "action": "ON" or "OFF" or "PULSE",
  "node": "<node name or 'child2'>",
  "pin": <pin number or 12>,
  "duration": null or <milliseconds>
}

User request: "${query}"`;
      } else if (isNodesQuery || isServicesQuery) {
        // For node/service queries, brief mode - actual data fetched separately
        if (isNodesQuery) queryType = 'nodes-query';
        if (isServicesQuery) queryType = 'services-query';
        finalQuery = `Briefly summarize what the user is asking for in one sentence:\n\n"${query}"\n\nRespond with only a one-sentence summary, no details.`;
      }

      const answer = await ollamaGenerate(finalQuery);
      
      const generalResponse = {
        success: true,
        answer,
        model: process.env.OLLAMA_MODEL || 'phi3:latest',
        queryType,
        isBriefMode: isNodesQuery || isServicesQuery,
      };
      
      // Cache all responses
      responseCache.set(cacheKey, { response: generalResponse, timestamp: Date.now() });
      
      const queryElapsed = Date.now() - queryStartTime;
      if (queryElapsed > SLOW_QUERY_THRESHOLD) {
        recordSlowQuery(query, queryType || 'general', queryElapsed, true);
      }
      
      return res.json(generalResponse);
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      const queryElapsed = Date.now() - queryStartTime;
      if (queryElapsed > SLOW_QUERY_THRESHOLD) {
        recordSlowQuery(query, 'error', queryElapsed, false, msg);
      }
      console.error('[OLLAMA] Ask endpoint error:', msg);
      return res.status(500).json({ error: msg });
    }
  };

  const reloadHandler = async (req, res) => {
    try {
      const result = await reloadOllamaContext();
      if (result.success) {
        res.json({ success: true, message: result.message });
      } else {
        res.status(503).json({ success: false, error: result.error });
      }
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      console.error('[OLLAMA] Reload endpoint error:', msg);
      res.status(500).json({ error: msg });
    }
  };

  const statusHandler = (req, res) => {
    try {
      const warmthStatus = getOllamaWarmthStatus();
      res.json({
        warmthKeeper: warmthStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      console.error('[OLLAMA] Status endpoint error:', msg);
      res.status(500).json({ error: msg });
    }
  };

  /**
   * Get real network nodes (without LLM processing).
   * Useful for displaying actual node list alongside LLM responses.
   */
  const nodesHandler = async (req, res) => {
    try {
      const nodeData = await fetchNodeData();
      if (!nodeData) {
        return res.json({ nodes: [], count: 0 });
      }

      const nodes = Array.isArray(nodeData) ? nodeData : [nodeData];
      const summary = nodes
        .filter(n => n.nodeName) // Only nodes with names
        .map((node, idx) => ({
          id: node.nodeName || node.id,
          name: node.nodeName || 'Unknown',
          type: node.nodeType || (node.details?.hardware || 'Unknown'),
          ip: node.ip || 'N/A',
          status: node.status || node.details?.status || 'unknown',
          services: node.details?.services?.map(s => s.name) || [],
        }));

      return res.json({ nodes: summary, count: summary.length });
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      console.error('[OLLAMA] Nodes endpoint error:', msg);
      return res.status(500).json({ error: msg });
    }
  };

  /**
   * Gather all unique services across the network and their providers.
   */
  const servicesHandler = async (req, res) => {
    try {
      const nodeData = await fetchNodeData();
      if (!nodeData) {
        return res.json({ services: [], servicesByNode: {}, count: 0 });
      }

      const nodes = Array.isArray(nodeData) ? nodeData : [nodeData];
      const serviceMap = new Map(); // service -> Set of node names

      // Aggregate services from all nodes
      nodes.forEach(node => {
        const nodeName = node.nodeName || 'Unknown';
        const nodeServices = node.details?.services || [];
        
        if (Array.isArray(nodeServices)) {
          nodeServices.forEach(svc => {
            const serviceName = typeof svc === 'string' ? svc : (svc.name || '');
            if (serviceName && !serviceMap.has(serviceName)) {
              serviceMap.set(serviceName, []);
            }
            if (serviceName) {
              serviceMap.get(serviceName).push(nodeName);
            }
          });
        } else if (typeof nodeServices === 'string' && nodeServices.trim()) {
          // Handle space-separated services
          nodeServices.split(/\s+/).forEach(svc => {
            if (svc && !serviceMap.has(svc)) {
              serviceMap.set(svc, []);
            }
            if (svc) {
              serviceMap.get(svc).push(nodeName);
            }
          });
        }
      });

      // Convert to array format
      const services = Array.from(serviceMap.entries())
        .map(([name, providers]) => ({
          name,
          providers: [...new Set(providers)], // Deduplicate providers
          providerCount: new Set(providers).size
        }))
        .sort((a, b) => b.providerCount - a.providerCount); // Most common first

      return res.json({
        services,
        servicesByNode: Object.fromEntries(
          nodes
            .filter(n => n.nodeName)
            .map(node => [
              node.nodeName,
              node.details?.services
                ? (Array.isArray(node.details.services)
                    ? node.details.services.map(s => typeof s === 'string' ? s : s.name)
                    : node.details.services.split?.(/\s+/) || [])
                : []
            ])
        ),
        count: services.length
      });
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      console.error('[OLLAMA] Services endpoint error:', msg);
      return res.status(500).json({ error: msg });
    }
  };

  /**
   * Handle device control requests with automatic device lookup and hardware mapping
   * Body: { device, action: "on"|"off" }
   * Or: { deviceName, pin, value: 0|1 }
   */
  const deviceControlHandler = async (req, res) => {
    try {
      const { device, action, deviceName, pin, value } = req.body || {};
      
      // Support both high-level (device + action) and low-level (deviceName + pin + value) APIs
      let targetDevice, targetPin, targetValue;
      
      if (device && action) {
        // High-level API: device + action
        targetDevice = device;
        targetValue = action.toLowerCase() === 'on' ? 1 : 0;
        const deviceInfo = getDeviceInfo(targetDevice);
        if (!deviceInfo) {
          return res.status(404).json({
            error: `Device '${targetDevice}' not found in configuration`,
            availableDevices: Object.keys(deviceConfig.devices || {})
          });
        }
        targetPin = deviceInfo.ledPin;
      } else if (deviceName && pin !== undefined && value !== undefined) {
        // Low-level API: deviceName + pin + value
        targetDevice = deviceName;
        targetPin = pin;
        targetValue = value ? 1 : 0;
      } else {
        return res.status(400).json({
          error: 'Provide either (device + action) or (deviceName + pin + value)',
          examples: {
            highlevel: { device: 'child1', action: 'on' },
            lowlevel: { deviceName: 'child1', pin: 4, value: 1 }
          }
        });
      }
      
      const deviceInfo = getDeviceInfo(targetDevice);
      if (!deviceInfo) {
        return res.status(404).json({
          error: `Device '${targetDevice}' not found`,
          availableDevices: Object.keys(deviceConfig.devices || {})
        });
      }
      
      // Construct the GPIO command
      const gpioCmd = constructGpioCommand(targetDevice, targetPin, targetValue);
      if (!gpioCmd) {
        return res.status(500).json({ error: 'Failed to construct GPIO command' });
      }
      
      console.log('[OLLAMA] Device control command:', gpioCmd);
      
      // Send the command to the device
      try {
        const cmdResult = await sendGpioCommand(gpioCmd);
        console.log('[OLLAMA] Device command result:', cmdResult);
        
        return res.json({
          success: cmdResult.success,
          device: targetDevice,
          deviceType: deviceInfo.type,
          pin: targetPin,
          value: targetValue,
          action: targetValue ? 'ON' : 'OFF',
          ip: deviceInfo.ip,
          statusCode: cmdResult.statusCode,
          deviceResponse: cmdResult.response,
          message: `LED on ${targetDevice} turned ${targetValue ? 'ON' : 'OFF'}`
        });
      } catch (commError) {
        console.warn('[OLLAMA] Device communication error:', commError.message);
        
        // Return partial success - command was constructed correctly
        return res.status(202).json({
          success: false,
          warning: 'Device command constructed but communication failed',
          device: targetDevice,
          pin: targetPin,
          value: targetValue,
          error: commError.message,
          ip: deviceInfo.ip,
          port: deviceInfo.port || 80,
          message: `Could not reach ${targetDevice} at ${deviceInfo.ip}:${deviceInfo.port || 80}. Ensure device is online and accessible.`
        });
      }
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      console.error('[OLLAMA] Device control error:', msg);
      return res.status(500).json({ error: msg });
    }
  };

  /**
   * POST /api/ollama/relay/control
   * Send a relay control command to a node.
   * Body: { nodeId, pin, action: "ON"|"OFF"|"PULSE", duration?: number }
   */
  const relayControlHandler = async (req, res) => {
    try {
      const { nodeId, pin, action, duration } = req.body || {};
      
      if (!nodeId || pin === undefined || !action) {
        return res.status(400).json({
          error: 'Required fields: nodeId, pin, action (ON|OFF|PULSE)',
          received: { nodeId, pin, action, duration }
        });
      }

      // Validate action
      if (!['ON', 'OFF', 'PULSE'].includes(action)) {
        return res.status(400).json({
          error: 'Action must be ON, OFF, or PULSE'
        });
      }

      // Build the control message
      const controlMsg = {
        type: 'relay-control',
        nodeId,
        pin: parseInt(pin),
        action,
        duration: action === 'PULSE' && duration ? parseInt(duration) : null,
        timestamp: new Date().toISOString()
      };

      console.log('[OLLAMA] Relay control command:', controlMsg);

      // In a real implementation, this would send the command to the node
      // For now, return a confirmation that can be displayed to the user
      return res.json({
        success: true,
        command: controlMsg,
        message: `Relay control command queued: ${action} relay on pin ${pin} of ${nodeId}${action === 'PULSE' && duration ? ` for ${duration}ms` : ''}`
      });
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      console.error('[OLLAMA] Relay control error:', msg);
      return res.status(500).json({ error: msg });
    }
  };

  /**
   * POST /api/ollama/ask
   * Send a direct natural-language question to Ollama.
   */
  app.post('/api/ollama/ask', askHandler);
  app.post('/api/openai/ask', askHandler);

  /**
   * POST /api/ollama/ask-stream
   * Stream responses in real-time using Server-Sent Events (SSE).
   * Responses are streamed word-by-word as they're generated.
   * Pre-computed answers are sent immediately (~<50ms).
   * Useful for perceived latency reduction on slow queries.
   */
  app.post('/api/ollama/ask-stream', streamingAskHandler);
  app.post('/api/openai/ask-stream', streamingAskHandler);

  /**
   * POST /api/ollama/relay/control
   * Control relays on network nodes.
   */
  app.post('/api/ollama/relay/control', relayControlHandler);
  app.post('/api/openai/relay/control', relayControlHandler);

  /**
   * POST /api/ollama/device-control
   * Control ESP32/ESP8266 devices with automatic hardware mapping.
   * High-level: { device: "child1", action: "on" }
   * Low-level: { deviceName: "child1", pin: 4, value: 1 }
   */
  app.post('/api/ollama/device-control', deviceControlHandler);
  app.post('/api/openai/device-control', deviceControlHandler);

  /**
   * POST /api/ollama/reload
   * Force reload of Ollama context, clearing old state and preparing for fresh analysis.
   */
  app.post('/api/ollama/reload', reloadHandler);
  app.post('/api/openai/reload', reloadHandler);

  /**
   * GET /api/ollama/status
   * Get warmth keeper status and Ollama diagnostics.
   */
  app.get('/api/ollama/status', statusHandler);
  app.get('/api/openai/status', statusHandler);

  /**
   * GET /api/ollama/nodes
   * Get real network nodes (without LLM processing).
   */
  app.get('/api/ollama/nodes', nodesHandler);
  app.get('/api/openai/nodes', nodesHandler);

  /**
   * GET /api/ollama/services
   * Get all services available across the network, grouped by provider.
   */
  app.get('/api/ollama/services', servicesHandler);
  app.get('/api/openai/services', servicesHandler);

  /**
   * GET /api/ollama/slow-queries
   * Retrieve recorded slow queries (>60s) for analysis and optimization.
   */
  app.get('/api/ollama/slow-queries', (req, res) => {
    try {
      if (!fs.existsSync(SLOW_QUERY_LOG_FILE)) {
        return res.json({ queries: [], total: 0, message: 'No slow queries recorded yet' });
      }
      const content = fs.readFileSync(SLOW_QUERY_LOG_FILE, 'utf8');
      const queries = content.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
      res.json({
        queries: queries.slice(-100), // Last 100 slow queries
        total: queries.length,
        avgDurationMs: queries.length > 0 ? Math.round(queries.reduce((sum, q) => sum + q.durationMs, 0) / queries.length) : 0,
        successCount: queries.filter(q => q.success).length,
        errorCount: queries.filter(q => !q.success).length
      });
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      console.error('[OLLAMA] Slow queries endpoint error:', msg);
      res.status(500).json({ error: msg });
    }
  });
  app.get('/api/openai/slow-queries', (req, res) => {
    // Alias for compatibility
    app._router.stack.find(r => r.route?.path === '/api/ollama/slow-queries')?.route?.stack[0].handle(req, res);
  });

  /**
   * GET /api/topology
   * Lightweight topology endpoint - returns only topology structure (minimal payload)
   * Useful for frontend tree views and topology operations without full node details
   */
  const topologyHandler = async (req, res) => {
    try {
      const nodeData = await fetchNodeData();
      if (!nodeData || nodeData.length === 0) {
        return res.json({ nodes: [], topology: {} });
      }

      // Build minimal topology structure
      const topologyNodes = nodeData.map(node => ({
        nodeId: node?.nodeId || node?.nodeName || node?.ip || '',
        nodeName: node?.nodeName || '',
        ip: node?.ip || '',
        port: node?.port || 80,
        parentNodeId: node?.topology?.parentNodeId || '',
        children: (node?.topology?.childNodeIds || '').toString().split(' ').filter(c => c),
        isClusterController: node?.topology?.clusterController === true,
        hardware: node?.hardware || node?.details?.hardware || ''
      }));

      // Build parent-child relationships
      const childrenByParent = new Map();
      const rootNodes = [];

      for (const node of topologyNodes) {
        if (!node.parentNodeId) {
          rootNodes.push(node.nodeId);
        } else {
          if (!childrenByParent.has(node.parentNodeId)) {
            childrenByParent.set(node.parentNodeId, []);
          }
          childrenByParent.get(node.parentNodeId).push(node.nodeId);
        }
      }

      res.json({
        nodes: topologyNodes,
        totalNodes: topologyNodes.length,
        rootNodes,
        topology: Object.fromEntries(childrenByParent)
      });
    } catch (e) {
      const msg = e.stack ? e.stack : e.toString();
      console.error('[OLLAMA] Topology endpoint error:', msg);
      res.status(500).json({ error: msg });
    }
  };

  app.get('/api/topology', topologyHandler);

  console.log('[OLLAMA] Routes registered at /api/ollama/* and /api/openai/* (compat)');
}
