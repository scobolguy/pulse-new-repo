import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = await fs.readFile(path.resolve(__dirname, '../data/factorial-service.pas'), 'utf-8');
const r = compilePascalishProgramWithAntlr(src);
console.log(r.pcodeText);
