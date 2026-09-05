import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';

function parseArgs(argv) {
  const args = {
    in: './data/router-mapper.dsl',
    routerOut: './data/router-rules.generated.json',
    mappingOut: './data/data-mappings.generated.json',
    artifactOut: './data/router-mapper-compiled.json'
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--in') args.in = argv[i + 1];
    if (token === '--router-out') args.routerOut = argv[i + 1];
    if (token === '--mapping-out') args.mappingOut = argv[i + 1];
    if (token === '--artifact-out') args.artifactOut = argv[i + 1];
  }

  return args;
}

function programMapToRouterRules(programMap, serviceId) {
  const now = new Date().toISOString();
  return (programMap?.routers || []).map(router => ({
    id: router.id,
    name: router.id,
    serviceId: router.serviceId || serviceId,
    enabled: router.enabled !== false,
    inputQueue: router.inputQueue,
    description: router.description || '',
    ...(Array.isArray(router.methods) && router.methods.length > 0 ? { methods: router.methods } : {}),
    outputs: (router.outputs || []).map(out => ({
      queueName: out.queueName,
      ...(out.httpVerb ? { httpVerb: out.httpVerb } : {}),
      whenRule: out.whenRule,
      transformRule: out.transformRule
    })),
    createdAt: now,
    updatedAt: now
  }));
}

function programMapToDataMappings(programMap) {
  const now = new Date().toISOString();
  return (programMap?.entries || [])
    .filter(entry => entry && entry.kind === 'mapper')
    .map(entry => ({
      id: entry.id,
      name: entry.id,
      scope: entry.scope || 'global',
      ownerServiceId: entry.ownerServiceId || null,
      sourceTypeId: entry.sourceTypeId,
      targetTypeId: entry.targetTypeId,
      enabled: true,
      description: '',
      items: (entry.items || []).map(item => ({
        sourcePath: item.sourcePath,
        targetPath: item.targetPath,
        kind: 'leaf',
        sourceValueType: 'unknown',
        targetValueType: 'unknown',
        conversionRule: item.conversionRule
      })),
      createdAt: now,
      updatedAt: now
    }));
}

function compileViaPascalishGrammar(sourceText) {
  const compiledProgram = compilePascalishProgramWithAntlr(sourceText);
  const programMap = compiledProgram.programMap || {};
  const serviceId = programMap.serviceId || 'default-program';

  return {
    version: 1,
    compiledAt: new Date().toISOString(),
    compilerPipeline: 'pascalish-g4',
    serviceId,
    runtimeUnit: programMap.runtimeUnit || { kind: 'program', id: serviceId, refreshMs: null },
    ast: compiledProgram.ast || null,
    roles: [],
    codeLibraries: (programMap.localResources?.libraries || []).map(id => ({ type: 'LibraryDecl', id })),
    uses: [],
    interoperability: [],
    variableDeclarations: programMap.variableDeclarations || [],
    routerRules: programMapToRouterRules(programMap, serviceId),
    dataMappings: programMapToDataMappings(programMap),
    mapperImports: programMap.mapperImports || [],
    localResources: programMap.localResources || null,
    pcodeText: compiledProgram.pcodeText,
    programMap,
    ir: compiledProgram.ir,
    typeDeclarations: programMap.typeDeclarations || [],
    classDeclarations: programMap.classDeclarations || []
  };
}

export function compileRouterMapperDSL(sourceText) {
  return compileViaPascalishGrammar(String(sourceText || ''));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(args.in);
  const sourceText = await fs.readFile(inputPath, 'utf-8');

  const compiled = compileRouterMapperDSL(sourceText);

  const routerOutPath = path.resolve(args.routerOut);
  const mappingOutPath = path.resolve(args.mappingOut);
  const artifactOutPath = path.resolve(args.artifactOut);

  await fs.mkdir(path.dirname(routerOutPath), { recursive: true });
  await fs.mkdir(path.dirname(mappingOutPath), { recursive: true });
  await fs.mkdir(path.dirname(artifactOutPath), { recursive: true });

  await fs.writeFile(routerOutPath, `${JSON.stringify(compiled.routerRules, null, 2)}\n`, 'utf-8');
  await fs.writeFile(mappingOutPath, `${JSON.stringify(compiled.dataMappings, null, 2)}\n`, 'utf-8');
  await fs.writeFile(artifactOutPath, `${JSON.stringify(compiled, null, 2)}\n`, 'utf-8');

  console.log(`[DSL-COMPILER] Input: ${path.relative(process.cwd(), inputPath)}`);
  console.log(`[DSL-COMPILER] Router rules: ${path.relative(process.cwd(), routerOutPath)}`);
  console.log(`[DSL-COMPILER] Data mappings: ${path.relative(process.cwd(), mappingOutPath)}`);
  console.log(`[DSL-COMPILER] Full artifact: ${path.relative(process.cwd(), artifactOutPath)}`);
  console.log(`[DSL-COMPILER] Routers compiled: ${compiled.routerRules.length}`);
  console.log(`[DSL-COMPILER] Mappers compiled: ${compiled.dataMappings.length}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('[DSL-COMPILER] Failed:', err.message);
    process.exitCode = 1;
  });
}
