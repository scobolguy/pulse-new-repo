import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('../grammar/', import.meta.url));
const jar = fileURLToPath(new URL('../../../virtualMachines/esp32/aggregator/tools/antlr-4.13.2-complete.jar', import.meta.url));
execFileSync('java', ['-jar', jar, '-Dlanguage=JavaScript', '-visitor', '-no-listener',
  '-o', 'generated', 'ScreenCobol.g4'], { cwd, stdio: 'inherit' });
