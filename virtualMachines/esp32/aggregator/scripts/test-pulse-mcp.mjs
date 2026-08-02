import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const mcpUrl = process.env.PULSE_MCP_URL || 'http://127.0.0.1:4011/mcp';
const client = new Client({ name: 'pulse-mcp-smoke-test', version: '1.0.0' });

try {
  await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl)));
  const tools = await client.listTools();
  assert.ok(tools.tools.some(tool => tool.name === 'pulse_query'), 'pulse_query tool is missing');

  const result = await client.callTool({
    name: 'pulse_query',
    arguments: { message: 'show me the topology', channel: 'mcp' },
  });
  const payload = result.structuredContent || JSON.parse(result.content?.[0]?.text || '{}');
  assert.equal(payload.intentId, 'topology');
  assert.match(payload.output, /nodes?/i);
  console.log('[pulse-mcp] PASS: pulse_query returned the topology intent');
} finally {
  await client.close();
}