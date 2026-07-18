import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { playerManager } from '../music/PlayerManager';

export const data = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('Detiene la reproducción y limpia la cola');

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = interaction.member as GuildMember;
  if (!member.voice.channel) {
    return interaction.reply({ content: '❌ Debes estar en un canal de voz.', ephemeral: true });
  }

  const player = playerManager.get(interaction.guildId!);
  if (!player) {
    return interaction.reply({ content: '❌ No hay nada reproduciendo.', ephemeral: true });
  }

  player.stop();
  playerManager.destroy(interaction.guildId!);
  await interaction.reply('⏹️ Detenido y desconectado.');
}
