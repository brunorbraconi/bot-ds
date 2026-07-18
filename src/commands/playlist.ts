import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
} from 'discord.js';
import { playerManager } from '../music/PlayerManager';
import { savePlaylist, loadPlaylist, listPlaylists, deletePlaylist } from '../utils/database';
import { trackEmbed } from '../utils/embed';
import { Track } from '../music/Track';

export const data = new SlashCommandBuilder()
  .setName('playlist')
  .setDescription('Gestiona playlists guardadas')
  .addSubcommand((sub) =>
    sub
      .setName('save')
      .setDescription('Guarda la cola actual como playlist')
      .addStringOption((opt) =>
        opt.setName('name').setDescription('Nombre de la playlist').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('load')
      .setDescription('Carga una playlist guardada')
      .addStringOption((opt) =>
        opt.setName('name').setDescription('Nombre de la playlist').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('Lista las playlists guardadas')
  )
  .addSubcommand((sub) =>
    sub
      .setName('delete')
      .setDescription('Elimina una playlist guardada')
      .addStringOption((opt) =>
        opt.setName('name').setDescription('Nombre de la playlist').setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;
  const member = interaction.member as GuildMember;

  if (subcommand === 'save') {
    const player = playerManager.get(guildId);
    if (!player || player.queueSize === 0) {
      return interaction.reply({ content: '❌ No hay canciones en la cola para guardar.', ephemeral: true });
    }

    const name = interaction.options.getString('name', true);
    savePlaylist(guildId, name, player.allTracks);
    await interaction.reply(`💾 Playlist **${name}** guardada (${player.queueSize} canciones).`);
  }

  else if (subcommand === 'load') {
    const name = interaction.options.getString('name', true);
    const tracks = loadPlaylist(guildId, name);
    if (!tracks || tracks.length === 0) {
      return interaction.reply({ content: `❌ No se encontró la playlist **${name}**.`, ephemeral: true });
    }

    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: '❌ Debes estar en un canal de voz.', ephemeral: true });
    }

    const player = playerManager.create(guildId);
    if (!playerManager.has(guildId) || !player.current) {
      await player.connect(voiceChannel.id);
    }

    player.addTracks(tracks);

    if (!player.current) {
      await player.playNow();
    }

    await interaction.reply(`📂 Playlist **${name}** cargada (${tracks.length} canciones).`);
  }

  else if (subcommand === 'list') {
    const names = listPlaylists(guildId);
    if (names.length === 0) {
      return interaction.reply('📭 No hay playlists guardadas.');
    }
    const list = names.map((n, i) => `**${i + 1}.** ${n}`).join('\n');
    await interaction.reply(`📋 **Playlists guardadas:**\n${list}`);
  }

  else if (subcommand === 'delete') {
    const name = interaction.options.getString('name', true);
    const deleted = deletePlaylist(guildId, name);
    if (!deleted) {
      return interaction.reply({ content: `❌ No se encontró la playlist **${name}**.`, ephemeral: true });
    }
    await interaction.reply(`🗑️ Playlist **${name}** eliminada.`);
  }
}
