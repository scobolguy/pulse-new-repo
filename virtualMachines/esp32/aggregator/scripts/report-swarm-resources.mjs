import {
  collectEsp32Resources, collectJsPmachineResources, createSwarmResourceReporter,
} from '../src/backend/swarmResourceReporter.mjs';
import { withNextSwarmResourceSequence } from '../src/backend/swarmResourceSequence.mjs';

try {
  const reporter = createSwarmResourceReporter({
    endpoint: process.env.PULSE_SWARM_REPORT_URL,
    nodeId: process.env.PULSE_SWARM_NODE_ID,
    serviceId: process.env.PULSE_SWARM_SERVICE_ID,
    ownerAggregatorId: process.env.PULSE_OWNER_AGGREGATOR_ID,
    token: process.env.PULSE_SWARM_MACHINE_TOKEN,
    collect: () => {
      const source = process.env.PULSE_SWARM_RESOURCE_SOURCE || 'esp32';
      if (source === 'esp32')
        return collectEsp32Resources(process.env.PULSE_SWARM_SOURCE_URL || process.env.PULSE_ESP32_TEST_URL);
      if (source === 'js-pmachine')
        return collectJsPmachineResources(process.env.PULSE_SWARM_SOURCE_URL);
      throw new Error('PULSE_SWARM_RESOURCE_SOURCE must be esp32 or js-pmachine');
    },
  });
  const sequenceFile = process.env.PULSE_SWARM_REPORT_SEQUENCE_FILE;
  const sequenceText = process.env.PULSE_SWARM_REPORT_SEQUENCE;
  let initialSequence;
  if (sequenceText !== undefined) {
    if (!/^[0-9]+$/.test(sequenceText))
      throw new Error('PULSE_SWARM_REPORT_SEQUENCE must be a non-negative safe integer');
    initialSequence = Number(sequenceText);
    if (!Number.isSafeInteger(initialSequence))
      throw new Error('PULSE_SWARM_REPORT_SEQUENCE must be a non-negative safe integer');
  } else if (!sequenceFile) {
    throw new Error('Set PULSE_SWARM_REPORT_SEQUENCE or PULSE_SWARM_REPORT_SEQUENCE_FILE');
  }

  const intervalText = process.env.PULSE_SWARM_REPORT_INTERVAL_MS;
  const watching = process.argv.includes('--watch');
  if (process.argv.slice(2).some(argument => argument !== '--watch'))
    throw new Error('Only the optional --watch argument is supported');
  if (watching && !sequenceFile)
    throw new Error('Set PULSE_SWARM_REPORT_SEQUENCE_FILE when using --watch');
  if (watching && intervalText !== undefined &&
      (!/^[0-9]+$/.test(intervalText) || Number(intervalText) < 1000 ||
       !Number.isSafeInteger(Number(intervalText)) || Number(intervalText) > 300000))
    throw new Error('PULSE_SWARM_REPORT_INTERVAL_MS must be between 1000 and 300000');

  let stopping = false;
  let finishStop;
  const stopRequested = new Promise(resolve => { finishStop = resolve; });
  const stop = () => {
    stopping = true;
    finishStop();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  const intervalMs = intervalText === undefined ? 30000 : Number(intervalText);
  do {
    try {
      const send = sequence => reporter.reportOnce(sequence);
      const result = sequenceFile
        ? await withNextSwarmResourceSequence({ filePath: sequenceFile, initialSequence }, send)
        : await send(initialSequence);
      console.log(`Resource report accepted: sequence ${result.sequence}, health ${result.status}`);
    } catch (error) {
      console.error('[SWARM-REPORTER]', error.message);
      if (!watching) throw error;
    }
    if (watching && !stopping) {
      let timer;
      await Promise.race([
        new Promise(resolve => { timer = setTimeout(resolve, intervalMs); }),
        stopRequested,
      ]);
      clearTimeout(timer);
    }
  } while (watching && !stopping);
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
} catch (error) {
  console.error('[SWARM-REPORTER]', error.message);
  process.exitCode = 1;
}
