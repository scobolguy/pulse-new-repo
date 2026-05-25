const base = 'http://192.168.2.115';

async function main() {
  const getRes = await fetch(`${base}/pmachine/edge_ingress_config`);
  const getText = await getRes.text();
  console.log('=== EDGE INGRESS CONFIG BEFORE ===');
  console.log(`HTTP ${getRes.status}`);
  console.log(getText);

  let config;
  try {
    config = JSON.parse(getText);
  } catch (error) {
    throw new Error(`Could not parse edge ingress config: ${error.message}`);
  }

  const params = new URLSearchParams({
    workerCount: String(config.workerCount ?? 1),
    queueLength: String(config.queueLength ?? 32),
    resultLimit: String(config.resultLimit ?? 16),
    workerStackBytes: String(config.workerStackBytes ?? 12288),
    workerPriority: String(config.workerPriority ?? 3),
    preferredCore: String((config.preferredCore === -1 || config.preferredCore === undefined) ? 255 : config.preferredCore),
    reboot: '1'
  });

  const postRes = await fetch(`${base}/pmachine/edge_ingress_config`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: params
  });
  const postText = await postRes.text();
  console.log('=== EDGE INGRESS REBOOT POST ===');
  console.log(`HTTP ${postRes.status}`);
  console.log(postText);
}

main().catch(error => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
