import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { playerManager } from '../music/PlayerManager';

export const data = new SlashCommandBuilder()
  .setName('shuffle')
  .setDescription('Aleatoriza la cola de reproducción');

export async function execute(interaction: ChatInputCommandInteraction) {
  const player = playerManager.get(interaction.guildId!);
  if (!player || player.queueSize === 0) {
    return interaction.reply({ content: '❌ No hay canciones en la cola.', ephemeral: true });
  }

  player.shuffle();
  await interaction.reply(`🔀 Cola aleatorizada (**${player.queueSize}** canciones)`);
}
