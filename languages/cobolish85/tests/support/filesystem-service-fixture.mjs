import { createFilesystemService } from '../../../../virtualMachines/esp32/aggregator/filesystem-service.mjs';

if (!process.argv[2] || !process.send) throw new Error('Filesystem fixture requires a data root and IPC parent');
const service = await createFilesystemService({
  dataRoot: process.argv[2], host: '127.0.0.1', httpPort: 0, lifecycleEnv: {},
});
process.send({ port: service.getStatus().httpPort });

async function stop() {
  try {
    await service.stop();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (process.connected) process.disconnect();
  }
}
process.once('disconnect', stop);
process.on('message', command => {
  if (command !== 'stop') throw new Error(`Invalid filesystem fixture command: ${command}`);
  void stop();
});
