import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { playerManager } from '../music/PlayerManager';

export const data = new SlashCommandBuilder()
  .setName('volume')
  .setDescription('Ajusta el volumen (0-100%)')
  .addIntegerOption((opt) =>
    opt
      .setName('level')
      .setDescription('Nivel de volumen (0-100)')
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(100)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const player = playerManager.get(interaction.guildId!);
  if (!player) {
    return interaction.reply({ content: '❌ No hay nada reproduciendo.', ephemeral: true });
  }

  const level = interaction.options.getInteger('level', true);
  player.setVolume(level);
  await interaction.reply(`🔊 Volumen ajustado a **${level}%**`);
}
