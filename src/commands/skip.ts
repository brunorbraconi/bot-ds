import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { playerManager } from '../music/PlayerManager';

export const data = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Salta la canción actual');

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = interaction.member as GuildMember;
  if (!member.voice.channel) {
    return interaction.reply({ content: '❌ Debes estar en un canal de voz.', ephemeral: true });
  }

  const player = playerManager.get(interaction.guildId!);
  if (!player?.current) {
    return interaction.reply({ content: '❌ No hay nada reproduciendo.', ephemeral: true });
  }

  const skipped = player.skip();
  await interaction.reply(`⏭️ Saltada: **${skipped?.title ?? 'desconocida'}**`);
}
