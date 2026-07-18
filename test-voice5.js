const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus } = require('@discordjs/voice');
require('dotenv').config();

// Patch VoiceWebSocket to log close codes
const VoiceWebSocket = require('@discordjs/voice').VoiceWebSocket;
if (VoiceWebSocket) {
  const origConstructor = VoiceWebSocket.prototype.constructor;
  // We can't easily access the prototype constructor, so let's patch via the ws event
}

// Alternative: patch the underlying ws library
const WebSocket = require('ws');
const origClose = WebSocket.prototype.close;
// That's not useful either

// Best approach: listen for connection's internal networking via debug
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

client.once('ready', async () => {
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) { console.error('Guild not found'); process.exit(1); return; }
  const channel = guild.channels.cache.get('1484323666735923260');
  if (!channel) { console.error('Channel not found'); process.exit(1); return; }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    debug: true,
  });

  connection.on('debug', (msg) => {
    if (msg.includes('close') || msg.includes('code') || msg.includes('error') || msg.includes('CLOSE')) {
      console.log('D:', msg);
    }
  });
  connection.on('stateChange', (o, n) => {
    console.log(`S: ${o.status} -> ${n.status}`);
    // Try to access networking from state
    if (n.status === 'connecting') {
      const networking = Reflect.get(n, 'networking');
      if (networking) {
        // Listen for close on the networking
        networking.on('close', (code) => {
          console.log('NETWORKING CLOSE CODE:', code);
        });
        networking.on('error', (err) => {
          console.log('NETWORKING ERROR:', err.message);
        });
        // Patch the WebSocket close handler
        if (networking._state && networking._state.ws) {
          const ws = networking._state.ws;
          ws.on('close', (err) => {
            console.log('VOICEWS CLOSE: code=' + err.code + ' reason=' + (err.reason?.toString() || ''));
          });
        }
      }
    }
  });

  await new Promise(r => setTimeout(r, 20000));
  console.log('Final state:', connection.state.status);
  connection.destroy();
  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(console.error);
