const targets = process.argv.slice(2);
for (const ip of targets) {
  try {
    const response = await fetch(`http://${ip}/status`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) continue;
    const status = await response.json();
    if (String(status?.deviceRole || '').toLowerCase() === 'bonecrusher') {
      console.log(JSON.stringify({ ip, status }));
      process.exit(0);
    }
  } catch {}
}
process.exit(1);
