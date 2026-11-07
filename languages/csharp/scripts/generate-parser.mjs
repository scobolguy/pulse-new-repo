import { generateParser } from '../../dotnet/generate-parser.mjs';

generateParser(new URL('../', import.meta.url), 'Csharp').catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
