import askSdkCore from 'ask-sdk-core';
import { ExpressAdapter } from 'ask-sdk-express-adapter';
import { callPulseMcp } from './pulseMcpClient.mjs';

const { SkillBuilders, getIntentName, getRequestType, getSlotValue } = askSdkCore;
const SKILL_ID = String(process.env.PULSE_ALEXA_SKILL_ID || '').trim();

function speechFromResult(result) {
  const explicit = String(result.voiceReply || '').trim();
  if (explicit && explicit.toLowerCase() !== 'ok') return explicit;
  return String(result.output || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, ' and ')
    .replace(/&lt;/gi, ' less than ')
    .replace(/&gt;/gi, ' greater than ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 7000) || 'Pulse did not return a spoken response.';
}

export function createPulseAlexaSkill({ queryPulse = callPulseMcp } = {}) {
  const launchHandler = {
    canHandle: input => getRequestType(input.requestEnvelope) === 'LaunchRequest',
    handle: input => input.responseBuilder
      .speak('Pulse is ready. What would you like to know?')
      .reprompt('What would you like to ask Pulse?')
      .getResponse(),
  };

  const queryHandler = {
    canHandle: input => getRequestType(input.requestEnvelope) === 'IntentRequest'
      && getIntentName(input.requestEnvelope) === 'PulseQueryIntent',
    handle: async input => {
      const message = String(getSlotValue(input.requestEnvelope, 'query') || '').trim();
      if (!message) {
        return input.responseBuilder
          .speak('What would you like to ask Pulse?')
          .reprompt('Try asking Pulse to show all nodes.')
          .getResponse();
      }
      const result = await queryPulse({ message, channel: 'alexa' });
      return input.responseBuilder.speak(speechFromResult(result)).getResponse();
    },
  };

  const helpHandler = {
    canHandle: input => getRequestType(input.requestEnvelope) === 'IntentRequest'
      && getIntentName(input.requestEnvelope) === 'AMAZON.HelpIntent',
    handle: input => input.responseBuilder
      .speak('You can ask Pulse about nodes, devices, services, queues, topology, or finite state machines.')
      .reprompt('For example, say show all devices.')
      .getResponse(),
  };

  const stopHandler = {
    canHandle: input => getRequestType(input.requestEnvelope) === 'IntentRequest'
      && ['AMAZON.CancelIntent', 'AMAZON.StopIntent'].includes(getIntentName(input.requestEnvelope)),
    handle: input => input.responseBuilder.speak('Goodbye.').getResponse(),
  };

  const errorHandler = {
    canHandle: () => true,
    handle: (input, error) => {
      console.error('[ALEXA] Request failed:', error?.stack || error);
      return input.responseBuilder
        .speak('Pulse could not complete that request. Please try again.')
        .reprompt('What would you like to ask Pulse?')
        .getResponse();
    },
  };

  const builder = SkillBuilders.custom()
    .addRequestHandlers(launchHandler, queryHandler, helpHandler, stopHandler)
    .addErrorHandlers(errorHandler);
  if (SKILL_ID) builder.withSkillId(SKILL_ID);
  return builder.create();
}

export function registerAlexaRoute(app) {
  const verifySignature = process.env.PULSE_ALEXA_VERIFY_SIGNATURE !== '0';
  const adapter = new ExpressAdapter(createPulseAlexaSkill(), verifySignature, verifySignature);
  app.post('/alexa', ...adapter.getRequestHandlers());
}

export { speechFromResult };