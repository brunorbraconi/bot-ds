const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
require('dotenv').config();

// Patch the ws WebSocket constructor to log close codes
const OrigWS = require('ws');
const origWs = OrigWS.prototype;
const origSend = origWs.send;
const origClose = origWs.close;
let activeWS = null;

// Wrap the WebSocket constructor
const RealWS = OrigWS;
const origConstructor = RealWS;
// We need to intercept new WebSocket() calls

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

client.once('ready', async () => {
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) { console.error('Guild not found'); process.exit(1); return; }
  const channel = guild.channels.cache.get('1484323666735923260');
  if (!channel) { console.error('Channel not found'); process.exit(1); return; }

  // Monkey-patch: intercept all WebSocket constructions (for voice)
  const OrigWebSocket = require('ws');
  const origWsConstruct = OrigWebSocket;
  const origBind = origWsConstruct.bind;
  
  // Replace the WebSocket constructor with a proxied version
  const origModule = require('ws');
  const origModuleWs = origModule;
  
  const handler = {
    construct(target, args) {
      const instance = new target(...args);
      const url = args[0] || '';
      if (url.includes('discord.media') || url.includes('discord')) {
        console.log('WS CREATED for:', url?.slice(0, 100));
        
        instance.addEventListener('close', (event) => {
          console.log('WS CLOSE: code=' + event.code + ' reason=' + (event.reason || '(empty)'));
        });
        
        instance.addEventListener('error', (event) => {
          console.log('WS ERROR:', event.message || event.error?.message || 'unknown');
        });
        
        instance.addEventListener('open', () => {
          console.log('WS OPENED');
        });
      }
      return instance;
    }
  };

  const ProxiedWS = new Proxy(origModuleWs, handler);
  // This won't work because require caches the module...

  // Instead, let's just use a different approach - patch the global WebSocket
  // But Node.js ws module isn't global...

  // Let's just try the connection normally and see what info we get from debug
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    debug: true,
  });

  connection.on('debug', (msg) => {
    // Filter for important messages
    if (msg.includes('[WS]') || msg.includes('close') || msg.includes('error') || msg.includes('code')) {
      console.log('D:', msg.slice(0, 300));
    }
  });
  connection.on('stateChange', (o, n) => {
    console.log(`S: ${o.status} -> ${n.status}`);
  });
  connection.on('error', (err) => console.log('CONN ERROR:', err.message));
  
  // Monitor networking state via Reflect
  const checkNet = setInterval(() => {
    const state = connection.state;
    if (state.status === 'connecting') {
      const networking = Reflect.get(state, 'networking');
      if (networking && networking._state) {
        const wsState = networking._state.ws;
        if (wsState && wsState.ws) {
          const underlying = wsState.ws;
          if (underlying.readyState === 3) { // CLOSED
            console.log('Underlying WS is CLOSED');
          }
        }
      }
    }
  }, 500);

  await new Promise(r => setTimeout(r, 15000));
  clearInterval(checkNet);
  console.log('Final state:', connection.state.status);
  connection.destroy();
  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(console.error);
