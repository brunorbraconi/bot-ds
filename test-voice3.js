const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
require('dotenv').config();

// Monkey-patch VoiceConnection to log close codes
const VoiceConnection = require('@discordjs/voice').VoiceConnection;
const origConfigure = VoiceConnection.prototype.configureNetworking;
VoiceConnection.prototype.configureNetworking = function() {
  origConfigure.call(this);
  // Access the internal networking after creation
  const self = this;
  const origStateSetter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(self), 'state'
  );
  // We can't easily access networking, but we can wrap onNetworkingClose
};

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
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
    debug: true,
  });

  connection.on('debug', (msg) => {
    if (msg.includes('close') || msg.includes('error')) {
      console.log('DEBUG[close/error]:', msg);
    }
  });
  connection.on('stateChange', (oldState, newState) => {
    console.log(`State: ${oldState.status} -> ${newState.status}`);
  });
  connection.on('error', (err) => console.error('ERROR:', err.message, err.stack?.split('\n')[1]));

  // Get the internal networking when available
  let stateCheck = setInterval(() => {
    const state = connection.state;
    if (state.status === 'connecting') {
      const networking = Object.getOwnPropertyDescriptor(state, 'networking')?.value ||
                         Reflect.get(state, 'networking');
      if (networking) {
        const origClose = networking.onWsClose?.bind(networking);
        if (origClose && !networking._patched) {
          networking._patched = true;
          networking.onWsClose = function({ code, reason }) {
            console.log('NETWORKING WS CLOSE: code=', code, 'reason=', reason?.toString());
            return origClose({ code, reason });
          };
        }
      }
    }
  }, 100);

  setTimeout(() => {
    clearInterval(stateCheck);
    console.log('Final state:', connection.state.status);
    connection.destroy();
    client.destroy();
    process.exit(0);
  }, 15000);
});

client.login(process.env.DISCORD_TOKEN).catch(console.error);
