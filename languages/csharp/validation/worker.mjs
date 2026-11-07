import { compileCsharpToPcode } from '../src/compile-csharp-to-pcode.mjs';
import { observe } from '../../dotnet/validation/observe.mjs';

await observe(compileCsharpToPcode, process.argv.slice(2));
