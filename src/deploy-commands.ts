import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { logger } from './utils/logger';

config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  logger.error('Missing DISCORD_TOKEN or CLIENT_ID in .env');
  process.exit(1);
}

const commands: unknown[] = [];
const commandsPath = path.join(__dirname, 'commands');
const files = fs.readdirSync(commandsPath).filter(
  (f) => (f.endsWith('.ts') || f.endsWith('.js')) && !f.endsWith('.d.ts')
);

for (const file of files) {
  const command = require(path.join(commandsPath, file));
  if (command.data) {
    commands.push(command.data.toJSON());
    logger.info(`Loaded command: ${command.data.name}`);
  }
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    logger.info(`Registering ${commands.length} commands...`);

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
      logger.info(`Registered ${commands.length} commands for guild ${guildId} (instant).`);
    } else {
      const data: any = await rest.put(Routes.applicationCommands(clientId), {
        body: commands,
      });
      logger.info(`Registered ${data.length} commands globally (may take up to 1 hour).`);
    }
  } catch (err) {
    logger.error('Failed to register commands:', err);
  }
})();
