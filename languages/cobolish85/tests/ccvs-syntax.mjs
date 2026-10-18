import { ccvsCases } from './ccvs/catalog.mjs';
import { registerSyntaxTests } from './ccvs/syntax.mjs';

registerSyntaxTests(ccvsCases, import.meta.url);
