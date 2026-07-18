import { config } from 'dotenv';
config();

import { client } from './client';
import { logger } from './utils/logger';
import { playerManager } from './music/PlayerManager';
import { closeDb } from './utils/database';
import fs from 'fs';
import path from 'path';

const commands = new Map<string, (interaction: any) => Promise<void>>();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    commands.set(command.data.name, command.execute);
    logger.debug(`Loaded command: ${command.data.name}`);
  }
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const execute = commands.get(interaction.commandName);
  if (!execute) {
    await interaction.reply({ content: '❌ Comando desconocido.', ephemeral: true });
    return;
  }

  try {
    await execute(interaction);
  } catch (err: any) {
    logger.error(`Error executing ${interaction.commandName}:`, err.message);
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(`❌ Error: ${err.message}`);
    } else {
      await interaction.reply({ content: `❌ Error: ${err.message}`, ephemeral: true });
    }
  }
});

process.on('SIGINT', () => {
  logger.info('Shutting down...');
  closeDb();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down...');
  closeDb();
  client.destroy();
  process.exit(0);
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  logger.error('DISCORD_TOKEN is not set in .env');
  process.exit(1);
}

client.login(token);
