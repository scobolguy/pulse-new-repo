import { compileVb11ToPcode } from '../src/compile-vb11.mjs';
import { observe } from '../../dotnet/validation/observe.mjs';

await observe(compileVb11ToPcode, process.argv.slice(2));
