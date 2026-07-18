const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
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

  console.log('Joining voice channel with debug...');
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    debug: true,
  });

  connection.on('debug', (msg) => console.log('DEBUG:', msg.slice(0, 500)));
  connection.on('stateChange', (oldState, newState) => {
    console.log(`State: ${oldState.status} -> ${newState.status}`);
  });
  connection.on('error', (err) => console.error('ERROR:', err.message));

  await new Promise(r => setTimeout(r, 20000));

  console.log('Final state:', connection.state.status);
  connection.destroy();
  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(console.error);
