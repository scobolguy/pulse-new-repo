import assert from 'node:assert/strict';
import { createPulseAlexaSkill } from '../src/mcp/pulseAlexaSkill.mjs';

const baseEnvelope = {
  version: '1.0',
  session: {
    new: false,
    sessionId: 'test-session',
    application: { applicationId: 'test-application' },
    user: { userId: 'test-user' },
  },
  context: {
    System: {
      application: { applicationId: 'test-application' },
      user: { userId: 'test-user' },
      device: { deviceId: 'test-device', supportedInterfaces: {} },
      apiEndpoint: 'https://api.amazonalexa.com',
    },
  },
};

let receivedQuery = null;
const skill = createPulseAlexaSkill({
  queryPulse: async request => {
    receivedQuery = request;
    return { output: '<p>8 nodes are online</p>', voiceReply: 'OK', intentId: 'all-nodes' };
  },
});

const response = await skill.invoke({
  ...baseEnvelope,
  request: {
    type: 'IntentRequest',
    requestId: 'test-request',
    timestamp: new Date().toISOString(),
    locale: 'en-US',
    dialogState: 'COMPLETED',
    intent: {
      name: 'PulseQueryIntent',
      confirmationStatus: 'NONE',
      slots: {
        query: {
          name: 'query',
          value: 'show all nodes',
          confirmationStatus: 'NONE',
        },
      },
    },
  },
});

assert.deepEqual(receivedQuery, { message: 'show all nodes', channel: 'alexa' });
assert.match(response.response.outputSpeech.ssml, /8 nodes are online/i);
assert.equal(response.response.reprompt, undefined);
console.log('[pulse-alexa] PASS: custom intent called Pulse MCP and returned speech-safe output');