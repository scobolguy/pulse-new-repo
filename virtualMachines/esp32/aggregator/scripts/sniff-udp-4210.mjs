import dgram from 'dgram';

const PORT = 4210;
const WINDOW_MS = 20000;

const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
let count = 0;

socket.on('error', (err) => {
  console.error(`[sniff] socket error: ${err.message}`);
  process.exit(1);
});

socket.on('listening', () => {
  const addr = socket.address();
  console.log(`[sniff] listening on ${addr.address}:${addr.port} for ${WINDOW_MS}ms`);
});

socket.on('message', (msg, rinfo) => {
  count += 1;
  const body = msg.toString('utf8');
  const preview = body.length > 240 ? `${body.slice(0, 240)}...` : body;
  console.log(`[sniff] #${count} from ${rinfo.address}:${rinfo.port} (${msg.length} bytes)`);
  console.log(preview);
});

socket.bind(PORT, '0.0.0.0');

setTimeout(() => {
  console.log(`[sniff] done. captured ${count} packet(s).`);
  socket.close(() => process.exit(0));
}, WINDOW_MS);
