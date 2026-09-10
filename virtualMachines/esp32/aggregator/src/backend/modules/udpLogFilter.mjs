/**
 * Suppresses noisy [UDP]-prefixed console logs unless explicitly enabled.
 */
export function initializeUdpLogFilter(showUdpLogs) {
  if (showUdpLogs) return;

  const originalLog = console.log.bind(console);
  const originalInfo = console.info.bind(console);
  const originalDebug = console.debug.bind(console);
  const isUdpLog = (args) => typeof args?.[0] === 'string' && args[0].startsWith('[UDP]');

  console.log = (...args) => {
    if (isUdpLog(args)) return;
    originalLog(...args);
  };

  console.info = (...args) => {
    if (isUdpLog(args)) return;
    originalInfo(...args);
  };

  console.debug = (...args) => {
    if (isUdpLog(args)) return;
    originalDebug(...args);
  };
}
