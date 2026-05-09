// broker.js - Simple Message Broker with UDP advertisement and state control
import express from 'express';
import dgram from 'dgram';

export function createMessageBroker({ udpPort = 4211, advertiseInterval = 5000, name = 'JS-Broker' } = {}) {
  const router = express.Router();
  let state = 'stopped'; // started | stopped | quiesced
  const messages = [];

  // UDP advertisement
  const udp = dgram.createSocket('udp4');
  let advertiseTimer = null;
  function advertise() {
    if (state === 'started') {
      const msg = Buffer.from(`${name} online: BROKER IP: 127.0.0.1 STATE: ${state}`);
      udp.send(msg, 0, msg.length, udpPort, '255.255.255.255');
    }
  }
  udp.bind(() => {
    udp.setBroadcast(true);
    advertiseTimer = setInterval(advertise, advertiseInterval);
  });

  // State control endpoints
  router.post('/start', (req, res) => {
    state = 'started';
    res.json({ state });
  });
  router.post('/stop', (req, res) => {
    state = 'stopped';
    res.json({ state });
  });
  router.post('/quiesce', (req, res) => {
    state = 'quiesced';
    res.json({ state });
  });
  router.post('/unquiesce', (req, res) => {
    state = 'started';
    // Immediately advertise and ensure timer is running
    advertise();
    if (!advertiseTimer) {
      advertiseTimer = setInterval(advertise, advertiseInterval);
    }
    res.json({ state });
  });
  router.get('/state', (req, res) => {
    res.json({ state });
  });

  // Message endpoints (only if started)
  router.post('/publish', express.json(), (req, res) => {
    if (state !== 'started') return res.status(503).json({ error: 'Broker not available', state });
    const { topic, message } = req.body;
    if (!topic || !message) return res.status(400).json({ error: 'Missing topic or message' });
    messages.push({ topic, message, ts: Date.now() });
    res.json({ status: 'ok' });
  });
  router.get('/subscribe', (req, res) => {
    if (state !== 'started') return res.status(503).json({ error: 'Broker not available', state });
    const { topic } = req.query;
    const filtered = messages.filter(m => m.topic === topic);
    res.json({ messages: filtered });
  });

  // Cleanup
  function shutdown() {
    clearInterval(advertiseTimer);
    udp.close();
  }
  return { router, getState: () => state, shutdown };
}
