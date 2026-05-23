const targets = ['192.168.2.115', '192.168.2.116', '192.168.2.117', '192.168.2.118'];
for (const ip of targets) {
  try {
    const response = await fetch(`http://${ip}/status`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) continue;
    const status = await response.json();
    if (String(status?.deviceRole || '').toLowerCase() === 'bonecrusher') {
      console.log(ip);
      process.exit(0);
    }
  } catch {}
}
process.exit(1);
