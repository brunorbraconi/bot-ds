import { config } from 'dotenv';
config();

try {
  const ffmpegPath = require('ffmpeg-static') as string;
  process.env.FFMPEG_PATH = ffmpegPath;
  const ffmpegDir = require('path').dirname(ffmpegPath);
  process.env.PATH = ffmpegDir + require('path').delimiter + process.env.PATH;
} catch {
  // ffmpeg-static not available
}

import { GuildMember } from 'discord.js';
import { client } from './client';
import { logger } from './utils/logger';
import { closeDb } from './utils/database';
import { playerManager } from './music/PlayerManager';
import type { LoopMode } from './music/GuildPlayer';
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
  if (interaction.isButton()) {
    const guildId = interaction.guildId;
    if (!guildId) return;

    const player = playerManager.get(guildId);
    if (!player) {
      return interaction.reply({ content: '❌ No hay reproducción activa.', ephemeral: true });
    }

    const member = interaction.member as GuildMember;
    if (!member.voice.channel) {
      return interaction.reply({ content: '❌ Debes estar en un canal de voz.', ephemeral: true });
    }

    const customId = interaction.customId;

    if (customId.startsWith('music_pause_')) {
      player.pause();
      await interaction.deferUpdate();
    } else if (customId.startsWith('music_resume_')) {
      player.resume();
      await interaction.deferUpdate();
    } else if (customId.startsWith('music_skip_')) {
      player.skip();
      await interaction.deferUpdate();
    } else if (customId.startsWith('music_stop_')) {
      player.stop();
      await interaction.deferUpdate();
    } else if (customId.startsWith('music_queue_')) {
      const { queueEmbed } = await import('./utils/embed');
      const embed = queueEmbed(player.allTracks, player.current, player.loop);
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else if (customId.startsWith('music_loop_')) {
      const modes: LoopMode[] = ['none', 'track', 'queue'];
      const currentIndex = modes.indexOf(player.loop);
      const nextMode = modes[(currentIndex + 1) % modes.length];
      player.setLoop(nextMode);
      await player.sendNowPlayingMessage();
      await interaction.deferUpdate();
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const execute = commands.get(interaction.commandName);
  if (!execute) {
    await interaction.reply({ content: '❌ Comando desconocido.', ephemeral: true });
    return;
  }

  try {
    await execute(interaction);
  } catch (err: any) {
    logger.error(`Error executing ${interaction.commandName}:`, err);
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
