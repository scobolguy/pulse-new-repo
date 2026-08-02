import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const MCP_URL = process.env.PULSE_MCP_URL || 'http://127.0.0.1:4011/mcp';

export async function callPulseMcp({ message, channel = 'mcp', attachments = [] }) {
  const client = new Client({ name: `pulse-${channel}-client`, version: '1.0.0' });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL)));
    const result = await client.callTool({
      name: 'pulse_query',
      arguments: { message, channel, attachments },
    });
    if (result.isError) {
      throw new Error(result.content?.[0]?.text || 'Pulse MCP tool failed');
    }
    return result.structuredContent || JSON.parse(result.content?.[0]?.text || '{}');
  } finally {
    await client.close();
  }
}