import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, TextChannel } from 'discord.js';
import { playerManager } from '../music/PlayerManager';
import { resolveTrack } from '../utils/resolver';
import { trackEmbed } from '../utils/embed';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Reproduce una canción o playlist')
  .addStringOption((opt) =>
    opt.setName('query').setDescription('URL o término de búsqueda').setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = interaction.member as GuildMember;
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    return interaction.reply({ content: '❌ Debes estar en un canal de voz.', ephemeral: true });
  }

  await interaction.deferReply();

  const query = interaction.options.getString('query', true);
  const guildId = interaction.guildId!;

  try {
    const result = await resolveTrack(query, member.displayName);
    const tracks = Array.isArray(result) ? result : [result];

    if (tracks.length === 0) {
      return interaction.editReply('❌ No se encontraron resultados.');
    }

    const player = playerManager.create(guildId);

    if (!playerManager.has(guildId) || !player.current) {
      await player.connect(voiceChannel.id);
    }

    if (interaction.channel) player.setTextChannel(interaction.channel as TextChannel);

    player.addTracks(tracks);

    if (!player.current) {
      await player.playNow();
    }

    const isPlaylist = tracks.length > 1;
    const first = tracks[0];
    const embed = trackEmbed(
      first,
      isPlaylist
        ? `✅ Agregadas **${tracks.length}** canciones a la cola`
        : `✅ Agregada a la cola: **${first.title}**`
    );

    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    logger.error(`[${guildId}] Play error:`, err);
    await interaction.editReply(`❌ Error: ${err.message}`);
  }
}
