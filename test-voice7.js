const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
require('dotenv').config();

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

  // Log ALL debug messages
  connection.on('debug', (msg) => console.log('D:', msg));
  connection.on('stateChange', (o, n) => console.log(`S: ${o.status} -> ${n.status}`));
  connection.on('error', (err) => console.log('ERR:', err.message, err.stack?.split('\n').slice(0,3).join(' | ')));

  // Try to find the networking instance
  const poll = setInterval(() => {
    const state = connection.state;
    const networking = Reflect.get(state, 'networking');
    if (networking) {
      clearInterval(poll);
      console.log('=== FOUND NETWORKING ===');
      console.log('Networking state code:', networking._state?.code);
      
      // Listen for close on networking
      networking.on('close', (code) => console.log('=== NETWORKING CLOSE: code=' + code));
      networking.on('error', (err) => console.log('=== NETWORKING ERROR:', err.message));
      
      // Access the VoiceWebSocket
      if (networking._state?.ws) {
        const vws = networking._state.ws;
        console.log('VoiceWS exists');
        vws.on('close', (event) => {
          console.log('=== VOICEWS CLOSE: code=' + event.code + ' reason=' + (event.reason?.toString() || ''));
        });
      }
    }
  }, 100);

  await new Promise(r => setTimeout(r, 15000));
  clearInterval(poll);
  connection.destroy();
  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(console.error);
