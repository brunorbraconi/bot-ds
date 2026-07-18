import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { playerManager } from '../music/PlayerManager';
import { LoopMode } from '../music/GuildPlayer';

export const data = new SlashCommandBuilder()
  .setName('loop')
  .setDescription('Configura el modo de repetición')
  .addStringOption((opt) =>
    opt
      .setName('mode')
      .setDescription('Modo de loop')
      .setRequired(true)
      .addChoices(
        { name: 'Ninguno', value: 'none' },
        { name: 'Repetir canción', value: 'track' },
        { name: 'Repetir cola', value: 'queue' },
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const player = playerManager.get(interaction.guildId!);
  if (!player) {
    return interaction.reply({ content: '❌ No hay nada reproduciendo.', ephemeral: true });
  }

  const mode = interaction.options.getString('mode', true) as LoopMode;
  player.setLoop(mode);

  const labels: Record<LoopMode, string> = {
    none: '❌ Loop desactivado',
    track: '🔂 Repitiendo canción',
    queue: '🔁 Repitiendo cola',
  };

  await interaction.reply(labels[mode]);
}
