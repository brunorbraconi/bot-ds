import { EmbedBuilder, ColorResolvable } from 'discord.js';
import { Track } from '../music/Track';

const COLORS: Record<string, ColorResolvable> = {
  youtube: 0xFF0000,
  soundcloud: 0xFF7700,
  default: 0x5865F2,
};

export function trackEmbed(track: Track, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS[track.source] ?? COLORS.default)
    .setTitle(track.title.slice(0, 256))
    .setURL(track.url)
    .addFields(
      { name: 'Duración', value: track.duration, inline: true },
      { name: 'Fuente', value: track.source, inline: true },
    )
    .setDescription(description)
    .setThumbnail(track.thumbnail ?? null)
    .setFooter({ text: `Solicitado por ${track.requestedBy}` });
}

export function queueEmbed(tracks: Track[], current: Track | null, loop: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.default)
    .setTitle('Cola de reproducción')
    .setDescription(`Loop: **${loop}**`);

  if (current) {
    embed.addFields({ name: 'Reproduciendo ahora', value: `[${current.title}](${current.url}) \`${current.duration}\`` });
  }

  if (tracks.length === 0) {
    embed.addFields({ name: 'Siguientes', value: 'No hay más canciones en la cola.' });
  } else {
    const lines = tracks.slice(0, 20).map((t, i) =>
      `**${i + 1}.** [${t.title}](${t.url}) \`${t.duration}\``
    );
    embed.addFields({ name: `Siguientes (${tracks.length})`, value: lines.join('\n') });
    if (tracks.length > 20) {
      embed.setFooter({ text: `Y ${tracks.length - 20} más...` });
    }
  }

  return embed;
}
