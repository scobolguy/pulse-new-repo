import { SERVICE_HOST_BINDINGS } from '../../pmachines/shared/contracts/service-host-bindings.mjs';

function moduleFor(name) {
  if ([
    'host.text_trim', 'host.text_split', 'host.text_split_lines',
    'host.string_lower', 'host.string_upper', 'host.string_length', 'host.string_replace',
    'host.string_compare', 'host.string_index', 'host.string_slice',
    'host.number_parse_integer', 'host.number_compare',
  ].includes(name)) return 'text';
  if (['host.date_iso', 'host.date_parse', 'host.date_now'].includes(name)) return 'date';
  if (name.startsWith('host.math_')
    || ['host.cobol_char', 'host.cobol_ord', 'host.date_current', 'host.date_accept'].includes(name)) return 'intrinsic';
  if (name.startsWith('host.isam_')) return 'isam';
  return null;
}

export function createCobolHostLibrary(filesystem) {
  const modules = new Map();
  const calls = new Set();
  let disposed = false;

  async function load(name) {
    if (disposed) throw new Error('COBOL host library has been disposed');
    if (!modules.has(name)) {
      const pending = (async () => {
        switch (name) {
          case 'text':
            return (await import('./text-bindings.mjs')).createDesktopTextBindings();
          case 'date':
            return (await import('./date-bindings.mjs')).createDesktopDateBindings();
          case 'intrinsic':
            return (await import('./intrinsic-bindings.mjs')).createDesktopIntrinsicBindings();
          case 'isam': {
            if (!filesystem) throw new Error('ISAM requires granted filesystem bindings');
            const module = await import('../isam/pcode-isam.mjs');
            return module.createPcodeIsamBindings(filesystem);
          }
          default:
            throw new Error(`Unknown COBOL host module: ${name}`);
        }
      })();
      modules.set(name, pending);
      pending.catch(() => {
        if (modules.get(name) === pending) modules.delete(name);
      });
    }
    const handlers = await modules.get(name);
    if (disposed) throw new Error('COBOL host library has been disposed');
    return handlers;
  }

  function callHost(name, args, context) {
    const work = (async () => {
      const module = moduleFor(name);
      if (!module || !Object.hasOwn(SERVICE_HOST_BINDINGS, name)) {
        throw new Error(`COBOL host binding unavailable: ${name}`);
      }
      const handlers = await load(module);
      if (typeof handlers[name] !== 'function') throw new Error(`COBOL host binding unavailable: ${name}`);
      return context === undefined ? handlers[name](...args) : handlers[name](...args, context);
    })();
    calls.add(work);
    work.then(() => calls.delete(work), () => calls.delete(work));
    return work;
  }

  const handlers = Object.fromEntries(Object.keys(SERVICE_HOST_BINDINGS)
    .filter(name => moduleFor(name))
    .map(name => [name, (...args) => callHost(name, args)]));

  return {
    handlers,
    callHost,
    loadedModules: () => [...modules.keys()],
    async dispose() {
      disposed = true;
      await Promise.allSettled(calls);
      const settled = await Promise.allSettled(modules.values());
      modules.clear();
      for (const result of settled) {
        if (result.status === 'fulfilled') result.value.dispose?.();
      }
    },
  };
}
