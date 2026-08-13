import { EmbedBuilder, ColorResolvable } from 'discord.js';
import { Track } from '../music/Track';
import type { LoopMode } from '../music/GuildPlayer';

const COLORS: Record<string, ColorResolvable> = {
  youtube: 0xFF0000,
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
    const lines: string[] = [];
    let length = 0;
    for (let i = 0; i < tracks.length; i++) {
      const line = `**${i + 1}.** [${tracks[i].title}](${tracks[i].url}) \`${tracks[i].duration}\``;
      if (lines.length > 0 && length + line.length + 1 > 1024) break;
      lines.push(line);
      length += line.length + 1;
    }
    embed.addFields({ name: `Siguientes (${tracks.length})`, value: lines.join('\n') });
    if (lines.length < tracks.length) {
      embed.setFooter({ text: `Y ${tracks.length - lines.length} más...` });
    }
  }

  return embed;
}

export function nowPlayingEmbed(track: Track, loop: LoopMode, volume: number, isPaused: boolean): EmbedBuilder {
  const status = isPaused ? '⏸️ En pausa' : '▶️ Reproduciendo';
  return new EmbedBuilder()
    .setColor(COLORS[track.source] ?? COLORS.default)
    .setTitle(status)
    .setDescription(`[${track.title}](${track.url})`)
    .addFields(
      { name: 'Duración', value: track.duration, inline: true },
      { name: 'Loop', value: loop, inline: true },
      { name: 'Volumen', value: `${volume}%`, inline: true },
    )
    .setThumbnail(track.thumbnail ?? null)
    .setFooter({ text: `Solicitado por ${track.requestedBy}` });
}
