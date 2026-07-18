// Test direct WebSocket connection to Discord voice server
const WebSocket = require('ws');

// From the debug logs: c-scl03-f87e6b05.discord.media:2087
async function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const url = `wss://${endpoint}?v=4`;
    console.log(`Connecting to: ${url}`);

    const ws = new WebSocket(url, { handshakeTimeout: 5000, rejectUnauthorized: false });

    const timer = setTimeout(() => {
      console.log(`  ${endpoint}: TIMEOUT (no close/error within 5s)`);
      ws.close();
      resolve(false);
    }, 5000);

    ws.on('open', () => {
      console.log(`  ${endpoint}: OPENED`);
    });

    ws.on('message', (data) => {
      const p = JSON.parse(data.toString());
      console.log(`  ${endpoint}: Received op=${p.op}:`, JSON.stringify(p.d).slice(0, 100));
      clearTimeout(timer);
      ws.close();
      resolve(true);
    });

    ws.on('close', (code, reason) => {
      console.log(`  ${endpoint}: CLOSE code=${code} reason=${reason?.toString() || '(empty)'}`);
      clearTimeout(timer);
      resolve(code !== undefined);
    });

    ws.on('error', (err) => {
      console.log(`  ${endpoint}: ERROR: ${err.message}`);
      clearTimeout(timer);
      resolve(false);
    });
  });
}

async function main() {
  // Known Discord voice endpoints to test
  const endpoints = [
    'c-scl03-f87e6b05.discord.media:2087',
    'c-scl03-f87e6b05.discord.media:443',
  ];

  for (const ep of endpoints) {
    const result = await testEndpoint(ep);
    console.log(`  Result: ${result ? 'OK' : 'FAIL'}`);
    console.log();
  }

  process.exit(0);
}

main();
