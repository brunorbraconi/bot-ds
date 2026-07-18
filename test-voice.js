const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.once('ready', async () => {
  console.log('Bot ready');
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) { console.error('Guild not found'); return; }

  const channel = guild.channels.cache.get('1484323666735923260');
  if (!channel) { console.error('Channel not found'); return; }

  console.log('Joining voice channel...');
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
  });

  connection.on('debug', (msg) => console.log('DEBUG:', msg));
  connection.on('stateChange', (oldState, newState) => {
    console.log(`State: ${oldState.status} -> ${newState.status}`);
    if (newState.status === VoiceConnectionStatus.Ready) {
      console.log('=== CONNECTION READY ===');
      console.log('State data:', JSON.stringify(newState, (k, v) => k === 'adapter' ? undefined : v));
    }
  });
  connection.on('error', (err) => console.error('Connection error:', err));

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
    console.log('Successfully connected!');
  } catch (e) {
    console.error('Failed to connect within 15s, final state:', connection.state.status);
  }

  setTimeout(() => {
    connection.destroy();
    client.destroy();
    process.exit(0);
  }, 5000);
});

client.login(process.env.DISCORD_TOKEN).catch(console.error);
