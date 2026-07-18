const WebSocket = require('ws');

const endpoint = 'wss://c-scl03-f87e6b05.discord.media:2087?v=4';
console.log('Connecting to:', endpoint);

const ws = new WebSocket(endpoint);

ws.on('open', () => {
  console.log('WebSocket OPEN');
  // Send Identify
  const identify = {
    op: 0,
    d: {
      server_id: '640118953267560469',
      user_id: '1528108264003342357',
      session_id: 'test-session',
      token: 'test-token'
    }
  };
  ws.send(JSON.stringify(identify));
  console.log('Sent Identify');
});

ws.on('message', (data) => {
  console.log('Received:', data.toString().slice(0, 200));
});

ws.on('close', (code, reason) => {
  console.log('WebSocket CLOSE:', code, reason?.toString());
});

ws.on('error', (err) => {
  console.log('WebSocket ERROR:', err.message);
});

setTimeout(() => {
  console.log('Timed out');
  ws.close();
  process.exit(0);
}, 10000);
