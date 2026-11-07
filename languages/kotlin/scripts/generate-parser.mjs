import { generateParser } from '../../dotnet/generate-parser.mjs';

generateParser(new URL('../', import.meta.url), 'Kotlin').catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
