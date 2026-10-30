import { executeProgram, parsePcode } from '../../pmachines/javascript/src/runtime.mjs';
import { createHash } from 'node:crypto';

export async function runRequester(artifact, values, send, { requestId } = {}) {
  if (requestId !== undefined && (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{16,96}$/.test(requestId))) {
    throw new Error('Invalid requester request ID');
  }
  let sendIndex = 0;
  const description = artifact.programMap.screenCobol;
  const output = {};
  const allowed = new Set(Object.values(description.screens).flatMap(screen => screen.fields)
    .filter(field => field.binding && field.direction !== 'FROM').map(field => field.binding));
  if (!values || typeof values !== 'object' || Array.isArray(values) ||
      Object.keys(values).some(key => !allowed.has(key))) throw new Error('Invalid screen input fields');
  const fit = (name, value) => {
    const field = description.fields[name];
    if (!field || typeof value !== 'string' || !/^[\x20-\x7e]*$/.test(value) || value.length > field.width) {
      throw new Error(`Invalid screen value for ${name}`);
    }
    return value.padEnd(field.width);
  };
  const result = await executeProgram({
    instructions: parsePcode(artifact.pcodeText), programMap: artifact.programMap, sourceMessage: '',
    runtimeContext: {
      maxSteps: 10000, maxStack: 256,
      async callHost(name, args) {
        if (name === 'screen.accept') return fit(args[0], values[args[0]] ?? description.fields[args[0]].value);
        if (name === 'screen.display') { output[args[0]] = fit(args[0], args[1]); return 0; }
        if (name === 'pathway.send') {
          const callId = requestId === undefined ? undefined : createHash('sha256')
            .update(`${requestId}:${sendIndex++}:${args[0]}`).digest('hex');
          const reply = await send(args[0], args[1], { requestId: callId });
          if (reply.code !== args[2]) throw new Error(`Unexpected reply code ${reply.code}`);
          if (typeof reply.data !== 'string') throw new Error('Server reply must contain a text record');
          return reply.data;
        }
        throw new Error(`Unsupported requester binding ${name}`);
      },
    },
  });
  if (result.error || result.stepLimitHit) throw new Error(result.error || 'Requester instruction budget exceeded');
  return { values: output, screen: description.initialScreen };
}
