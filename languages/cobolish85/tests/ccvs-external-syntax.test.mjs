import { syntaxOnlyCases } from './ccvs/catalog.mjs';
import { registerSyntaxTests } from './ccvs/syntax.mjs';

registerSyntaxTests(syntaxOnlyCases, import.meta.url);
