import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import onvif from 'onvif/promises/index.js';
import ffmpegPath from 'ffmpeg-static';

const cameraName = String(process.argv[2] || 'Office').trim();
const outputPath = path.resolve(process.argv[3] || './demo-output/office-camera-now.jpg');
const configuredCamera = String(process.env.TAPO_CAMERA_HOSTS || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean)
  .map(value => {
    const separator = value.lastIndexOf('@');
    return separator > 0
      ? { name: value.slice(0, separator).trim(), host: value.slice(separator + 1).trim() }
      : { name: value, host: value };
  })
  .find(camera => camera.name.toLowerCase() === cameraName.toLowerCase());

if (!configuredCamera) throw new Error(`Camera "${cameraName}" is not configured`);
if (!process.env.TAPO_CAMERA_USERNAME || !process.env.TAPO_CAMERA_PASSWORD) {
  throw new Error('Tapo Camera Account credentials are not configured');
}

const camera = new onvif.Cam({
  hostname: configuredCamera.host,
  port: 2020,
  username: process.env.TAPO_CAMERA_USERNAME,
  password: process.env.TAPO_CAMERA_PASSWORD,
  timeout: 8000
});
await camera.connect();
const stream = await camera.getStreamUri({ protocol: 'RTSP' });
const input = new URL(stream.uri);
input.username = process.env.TAPO_CAMERA_USERNAME;
input.password = process.env.TAPO_CAMERA_PASSWORD;
await fs.mkdir(path.dirname(outputPath), { recursive: true });

await new Promise((resolve, reject) => {
  const ffmpeg = spawn(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error', '-rtsp_transport', 'tcp',
    '-i', input.toString(), '-frames:v', '1', '-q:v', '2', '-y', outputPath
  ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let errorText = '';
  ffmpeg.stderr.on('data', chunk => { errorText += String(chunk); });
  ffmpeg.once('error', reject);
  ffmpeg.once('close', code => code === 0 ? resolve() : reject(new Error(errorText.trim() || `FFmpeg exited with ${code}`)));
});

console.log(outputPath);
