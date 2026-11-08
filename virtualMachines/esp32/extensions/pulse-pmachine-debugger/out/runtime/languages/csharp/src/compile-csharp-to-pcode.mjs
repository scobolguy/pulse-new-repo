import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseCsharp } from './parser.mjs';
import { compileScalarToPcode } from '../../dotnet/compile-scalar-to-pcode.mjs';
import { prepareScalarImports, linkScalarLibraries } from '../../dotnet/scalar-library.mjs';
import { createDotnetServiceContract } from '../../dotnet/service-contract.mjs';

export function compileCsharpToPcode(source, { fileName = 'program.cs', libraries = [], target = 'js' } = {}) {
  if (typeof source !== 'string') throw new TypeError('C# source must be a string');
  const program = parseCsharp(source, { fileName });
  const serviceClass = program.classes.find(item =>
    item.modifiers.has('sealed') && item.methods.some(method => method.attributes.some(attribute =>
      ['HttpGet', 'HttpPost'].includes(attribute.name))));
  const serviceEndpoints = serviceClass ? serviceClass.methods.flatMap(method => method.attributes
    .filter(attribute => ['HttpGet', 'HttpPost'].includes(attribute.name))
    .map(attribute => ({
      verb: attribute.name === 'HttpGet' ? 'GET' : 'POST',
      path: attribute.arguments[0]?.value,
      handler: method.name
    }))) : [];
  let service = null;
  if (serviceClass) {
    if (program.classes.length !== 1) throw new Error('C# hosted services must contain one sealed service class');
    for (const endpoint of serviceEndpoints) {
      const method = serviceClass.methods.find(item => item.name === endpoint.handler);
      if (!method.async || method.returnType.name !== 'Task' || method.returnType.typeArguments?.length !== 1) {
        throw new Error(`C# service handler '${endpoint.handler}' must return async Task<T>`);
      }
      const cancellation = method.params.filter(parameter => parameter.type.name === 'CancellationToken');
      if (cancellation.length > 1 || method.params.some(parameter => parameter.type.name !== 'CancellationToken')) {
        throw new Error(`C# service handler '${endpoint.handler}' must use only CancellationToken parameters`);
      }
      method.returnType = method.returnType.typeArguments[0];
      method.params = [];
    }
    service = {
      id: serviceClass.name,
      handlers: serviceEndpoints.map(endpoint => endpoint.handler),
      contract: createDotnetServiceContract({ id: serviceClass.name, endpoints: serviceEndpoints })
    };
  }
  const imports = prepareScalarImports(libraries, 'csharp', target);
  const artifact = linkScalarLibraries(compileScalarToPcode(program, source, {
    fileName, sourceLanguage: 'csharp', imports, target, service
  }), libraries);
  if (service) {
    artifact.programMap.serviceEndpoints = service.contract.serviceEndpoints.map(endpoint => {
      const procedure = Object.values(artifact.programMap.procedures)
        .find(candidate => candidate.name.endsWith(`.${endpoint.handler}`));
      if (!procedure) throw new Error(`C# service endpoint handler not emitted: ${endpoint.handler}`);
      return { ...endpoint, entryLabel: procedure.label };
    });
  }
  return artifact;
}

export async function main(args = process.argv.slice(2)) {
  const [input, output, ...extra] = args;
  if (!input || !output || extra.length) throw new Error('Usage: node compile-csharp-to-pcode.mjs input.cs output.pcode');
  const artifact = compileCsharpToPcode(await fs.readFile(input, 'utf8'), { fileName: path.resolve(input) });
  const mapOutput = output.replace(/(?:\.pcode)?$/, '.program.json');
  await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await fs.writeFile(output, artifact.pcodeText, 'utf8');
  await fs.writeFile(mapOutput, JSON.stringify(artifact.programMap, null, 2) + '\n', 'utf8');
  console.log(`Compiled ${input} -> ${output}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`[CSHARP] ${error.message}`); process.exitCode = 1; });
}
