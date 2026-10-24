import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export async function findPmachineRoot(filePath: string, workspacePath?: string): Promise<string> {
  const visited = new Set<string>();
  for (const start of [path.dirname(path.resolve(filePath)), ...(workspacePath ? [path.resolve(workspacePath)] : [])]) {
    let directory = start;
    while (!visited.has(directory)) {
      visited.add(directory);
      for (const candidate of [directory, path.join(directory, 'virtualMachines', 'esp32')]) {
        try {
          const stat = await fs.stat(path.join(candidate, 'aggregator', 'scripts', 'run-js-pmachine.mjs'));
          if (stat.isFile()) return candidate;
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (code !== 'ENOENT' && code !== 'ENOTDIR') throw error;
        }
      }
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
  }
  throw new Error('Cannot find the Pulse compiler/runtime checkout. Open the Pulse repository or its ESP32 workspace.');
}
