export async function callMapperSync(baseUrl, payload) {
  const response = await fetch(`${baseUrl}/map`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`sync mapper call failed: HTTP ${response.status}`);
  return response.json();
}

export async function callMapperAsync(baseUrl, payload) {
  const response = await fetch(`${baseUrl}/map/async`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (response.status !== 202) throw new Error(`async mapper call failed: HTTP ${response.status}`);
  const queued = await response.json();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const result = await fetch(`${baseUrl}/jobs/${encodeURIComponent(queued.jobId)}`);
    const job = await result.json();
    if (job.status === 'completed') return job.result;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`async mapper job timed out: ${queued.jobId}`);
}
