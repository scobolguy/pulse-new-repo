import { generateCobolishParser } from '../../../../languages/cobolish85/scripts/generate-parser.mjs';
import { generatePascalishParser } from '../../../../languages/pascalish/scripts/generate-parser.mjs';
import { generateMaplParser } from '../../../../languages/mapl/scripts/generate-parser.mjs';
import { generateWflParser } from '../../../../languages/wfl/scripts/generate-parser.mjs';
import { generateVbishParser } from '../../../../languages/vbish/scripts/generate-parser.mjs';

async function main() {
  await generatePascalishParser();
  await generateMaplParser();
  await generateWflParser();
  await generateCobolishParser();
  await generateVbishParser();
  console.log('[ANTLR] Generated JS parsers in their canonical languages directories');
}

main().catch(err => {
  console.error('[ANTLR] Failed:', err.message);
  process.exitCode = 1;
});
