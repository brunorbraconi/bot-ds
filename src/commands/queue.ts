import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { playerManager } from '../music/PlayerManager';
import { queueEmbed } from '../utils/embed';

export const data = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Muestra la cola de reproducción');

export async function execute(interaction: ChatInputCommandInteraction) {
  const player = playerManager.get(interaction.guildId!);
  if (!player) {
    return interaction.reply({ content: '❌ No hay nada reproduciendo.', ephemeral: true });
  }

  const embed = queueEmbed(player.allTracks, player.current, player.loop);
  await interaction.reply({ embeds: [embed] });
}
