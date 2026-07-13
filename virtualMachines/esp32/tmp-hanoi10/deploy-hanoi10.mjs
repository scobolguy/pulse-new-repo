import fs from 'node:fs/promises';
import path from 'node:path';

const ip = '192.168.2.157';
const n = Math.max(1, Number.parseInt(process.argv[2] || '10', 10) || 10);
const baseUrl = `http://${ip}:80`;
const pcodePath = path.resolve(process.cwd(), `tmp-hanoi${n}`, `hanoi${n}.pcode`);
const mapPath = path.resolve(process.cwd(), `tmp-hanoi${n}`, `hanoi${n}.program.json`);
const remotePcodePath = `/pmachine/programs/hanoi${n}.pcode`;
const remoteSignedMapPath = `/pmachine/programs/hanoi${n}.program.signed.json`;
const remoteMapPath = `/pmachine/programs/hanoi${n}.program.json`;

async function upload(remotePath, localPath) {
  const bodyText = await fs.readFile(localPath, 'utf8');
  const response = await fetch(`${baseUrl}/ffs/upload`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      file: remotePath,
      body: bodyText
    })
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Upload failed for ${remotePath}: ${response.status} ${text}`);
  }
  return text;
}

async function execute(remoteMap) {
  const response = await fetch(`${baseUrl}/pmachine/execute_file`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      file: remotePcodePath,
      programMap: remoteMap,
      inputQueue: 'default.in',
      message: ''
    })
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Execute failed: ${response.status} ${text}`);
  }
  return text;
}

const signedMapPath = mapPath.replace('.json', '.signed.json');
const signedMap = JSON.parse(await fs.readFile(mapPath, 'utf8'));
await fs.writeFile(signedMapPath, `${JSON.stringify(signedMap, null, 2)}\n`, 'utf8');

console.log(await upload(remotePcodePath, pcodePath));
console.log(await upload(remoteMapPath, mapPath));
console.log(await upload(remoteSignedMapPath, signedMapPath));
console.log(await execute(remoteSignedMapPath));
