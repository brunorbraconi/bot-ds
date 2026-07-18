import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} from 'discord.js';
import play from 'play-dl';
import { playerManager } from '../music/PlayerManager';
import { trackEmbed } from '../utils/embed';
import { Track, TrackSource } from '../music/Track';

export const data = new SlashCommandBuilder()
  .setName('search')
  .setDescription('Busca canciones en YouTube')
  .addStringOption((opt) =>
    opt.setName('query').setDescription('Término de búsqueda').setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = interaction.member as GuildMember;
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    return interaction.reply({ content: '❌ Debes estar en un canal de voz.', ephemeral: true });
  }

  await interaction.deferReply();

  const query = interaction.options.getString('query', true);

  try {
    const results = await play.search(query, { limit: 10 });
    if (results.length === 0) {
      return interaction.editReply('❌ No se encontraron resultados.');
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('search-select')
      .setPlaceholder('Selecciona una canción')
      .addOptions(
        results.map((r, i) => ({
          label: (r.title ?? 'Unknown').slice(0, 100),
          value: String(i),
          description: `${r.channel?.name ?? 'Unknown'} - ${r.durationRaw ?? '0:00'}`.slice(0, 100),
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const reply = await interaction.editReply({
      content: 'Resultados de búsqueda:',
      components: [row],
    });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 30_000,
    });

    collector.on('collect', async (selectInteraction) => {
      if (selectInteraction.user.id !== interaction.user.id) {
        return selectInteraction.reply({ content: '❌ No puedes usar esto.', ephemeral: true });
      }

      await selectInteraction.deferUpdate();
      collector.stop();

      const index = parseInt(selectInteraction.values[0], 10);
      const r = results[index];

      const track: Track = {
        url: r.url!,
        title: r.title ?? 'Unknown',
        duration: r.durationRaw ?? '0:00',
        durationMs: (r.durationInSec ?? 0) * 1000,
        source: 'youtube',
        thumbnail: r.thumbnails?.[0]?.url,
        author: r.channel?.name,
        requestedBy: member.displayName,
      };

      const player = playerManager.create(interaction.guildId!);
      if (!playerManager.has(interaction.guildId!) || !player.current) {
        await player.connect(voiceChannel.id);
      }

      player.addTrack(track);
      if (!player.current) {
        await player.playNow();
      }

      const embed = trackEmbed(track, `✅ Agregada a la cola: **${track.title}**`);
      await interaction.editReply({ embeds: [embed], components: [] });
    });

    collector.on('end', async (_collected, reason) => {
      if (reason === 'time') {
        await interaction.editReply({ content: '⏰ Tiempo de selección agotado.', components: [] });
      }
    });
  } catch (err: any) {
    await interaction.editReply(`❌ Error: ${err.message}`);
  }
}
