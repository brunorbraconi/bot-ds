const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus } = require('@discordjs/voice');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

client.once('ready', async () => {
  console.log('Bot ready');
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) { console.error('Guild not found'); return; }
  const channel = guild.channels.cache.get('1484323666735923260');
  if (!channel) { console.error('Channel not found'); return; }

  console.log('Joining...');
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    debug: true,
  });

  connection.on('debug', (msg) => { console.log('D:', msg); });
  connection.on('stateChange', (o, n) => { console.log(`S: ${o.status} -> ${n.status}`); });

  // Wait and then test direct WebSocket connection
  await new Promise(r => setTimeout(r, 5000));

  // Try a direct WebSocket connection to the same endpoint
  console.log('\n--- Testing direct WebSocket ---');
  const ws = new (require('ws'))('wss://c-scl03-f87e6b05.discord.media:2087?v=4', {
    handshakeTimeout: 5000,
  });

  ws.on('open', () => console.log('WS: OPEN'));
  ws.on('error', (e) => console.log('WS: ERROR:', e.message));
  ws.on('close', (code, reason) => {
    console.log(`WS: CLOSE code=${code} reason=${reason?.toString() || '(empty)'}`);
  });
  ws.on('message', (d) => {
    const p = JSON.parse(d.toString());
    console.log('WS: RCV op=' + p.op + ' ' + JSON.stringify(p.d).slice(0, 100));
    // Send Identify
    if (p.op === 8) { // Hello
      const identify = {
        op: 0,
        d: {
          server_id: '640118953267560469',
          user_id: '1528108264003342357',
          session_id: 'test123',
          token: 'test456'
        }
      };
      ws.send(JSON.stringify(identify));
      console.log('WS: Sent Identify');
    }
  });

  await new Promise(r => setTimeout(r, 10000));
  console.log('\nFinal state:', connection.state.status);
  connection.destroy();
  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(console.error);
