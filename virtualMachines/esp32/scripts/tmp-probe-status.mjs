const target = process.argv[2] || '192.168.2.115';
const response = await fetch(`http://${target}/status`, { signal: AbortSignal.timeout(3000) });
console.log(await response.text());
