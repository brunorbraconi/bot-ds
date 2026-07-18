import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { logger } from './utils/logger';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  logger.info(`Bot logged in as ${client.user?.tag}`);
});

client.on('error', (err) => {
  logger.error('Client error:', err.message);
});
