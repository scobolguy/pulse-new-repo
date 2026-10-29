import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
const bundledRoot = path.resolve(fileURLToPath(new URL('./runtime/virtualMachines/esp32/', import.meta.url)));
async function hasRuntime(root) {
    try {
        return (await fs.stat(path.join(root, 'aggregator', 'scripts', 'run-js-pmachine.mjs'))).isFile();
    }
    catch (error) {
        const code = error.code;
        if (code !== 'ENOENT' && code !== 'ENOTDIR')
            throw error;
        return false;
    }
}
export async function findPmachineRoot(filePath, workspacePath) {
    const visited = new Set();
    for (const start of [path.dirname(path.resolve(filePath)), ...(workspacePath ? [path.resolve(workspacePath)] : [])]) {
        let directory = start;
        while (!visited.has(directory)) {
            visited.add(directory);
            for (const candidate of [directory, path.join(directory, 'virtualMachines', 'esp32')]) {
                if (await hasRuntime(candidate))
                    return candidate;
            }
            const parent = path.dirname(directory);
            if (parent === directory)
                break;
            directory = parent;
        }
    }
    if (await hasRuntime(bundledRoot))
        return bundledRoot;
    throw new Error('The Pulse compiler/runtime is missing. Reinstall the Pulse Studio & PMachine Debugger VSIX.');
}
//# sourceMappingURL=runtimeRoot.js.map