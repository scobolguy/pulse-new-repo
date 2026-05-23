const [backendUrl, frontendUrl] = process.argv.slice(2);
async function check(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  return response.status;
}
const backend = await check(backendUrl);
const frontend = await check(frontendUrl);
console.log(JSON.stringify({ backend, frontend }));
