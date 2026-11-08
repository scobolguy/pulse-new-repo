import fs from 'node:fs/promises';
import path from 'node:path';
import { createFilesystemBindings } from './filesystem-bindings.mjs';

export async function createFortranRuntimeContext({ dataDirectory, stdin, inputFile } = {}) {
  if (typeof dataDirectory !== 'string' || !dataDirectory) throw new Error('FORTRAN dataDirectory is required');
  if (stdin !== undefined && typeof stdin !== 'string') throw new TypeError('FORTRAN stdin must be a string');
  if (stdin !== undefined && inputFile) throw new Error('Set either FORTRAN stdin or inputFile, not both');
  await fs.mkdir(dataDirectory, { recursive: true });
  const { handlers } = await createFilesystemBindings({ data: { path: path.resolve(dataDirectory), readOnly: false } });
  return {
    stdin: inputFile ? await fs.readFile(inputFile, 'utf8') : stdin ?? '',
    fileSystem: {
      async readText(name) {
        try { return await handlers['host.fs_read_text']('data', name); }
        catch (error) { if (error.code === 'ENOENT') return null; throw error; }
      },
      writeText: (name, text) => handlers['host.fs_write_text']('data', name, text),
      deleteFile: name => handlers['host.fs_delete']('data', name),
    },
  };
}
