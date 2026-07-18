import play, { SoundCloudTrack, SoundCloudPlaylist } from 'play-dl';
import { Track, TrackSource } from '../music/Track';

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function sourceFromUrl(url: string): TrackSource | null {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/soundcloud\.com/.test(url)) return 'soundcloud';
  return null;
}

export async function resolveTrack(
  query: string,
  requestedBy: string
): Promise<Track | Track[]> {
  const isUrl = /^https?:\/\//.test(query);

  if (!isUrl) {
    const results = await play.search(query, { limit: 1 });
    if (results.length === 0) throw new Error('No results found');
    const r = results[0];
    return {
      url: r.url!,
      title: r.title ?? 'Unknown',
      duration: r.durationRaw ?? '0:00',
      durationMs: (r.durationInSec ?? 0) * 1000,
      source: 'youtube',
      thumbnail: r.thumbnails?.[0]?.url,
      author: r.channel?.name,
      requestedBy,
    };
  }

  const source = sourceFromUrl(query);
  if (!source) throw new Error('URL no soportada. Usa YouTube o SoundCloud.');

  if (source === 'youtube') {
    if (/playlist\?list=|youtu\.be\/.*\?list=/.test(query)) {
      return resolveYoutubePlaylist(query, requestedBy);
    }
    return resolveYoutubeVideo(query, requestedBy);
  }

  if (source === 'soundcloud') {
    if (/\/sets\//.test(query)) {
      return resolveSoundcloudPlaylist(query, requestedBy);
    }
    return resolveSoundcloudTrack(query, requestedBy);
  }

  throw new Error('No se pudo resolver el track');
}

async function resolveYoutubeVideo(url: string, requestedBy: string): Promise<Track> {
  const info = await play.video_info(url);
  const v = info.video_details;
  return {
    url: v.url!,
    title: v.title!,
    duration: v.durationRaw,
    durationMs: (v.durationInSec ?? 0) * 1000,
    source: 'youtube',
    thumbnail: v.thumbnails?.[0]?.url,
    author: v.channel?.name,
    requestedBy,
  };
}

async function resolveYoutubePlaylist(url: string, requestedBy: string): Promise<Track[]> {
  const pl = await play.playlist_info(url);
  const videos = await pl.all_videos();
  return videos.map((v) => ({
    url: v.url!,
    title: v.title ?? 'Unknown',
    duration: v.durationRaw ?? '0:00',
    durationMs: (v.durationInSec ?? 0) * 1000,
    source: 'youtube' as TrackSource,
    thumbnail: v.thumbnails?.[0]?.url,
    author: v.channel?.name,
    requestedBy,
  }));
}

async function resolveSoundcloudTrack(url: string, requestedBy: string): Promise<Track> {
  const info = (await play.soundcloud(url)) as SoundCloudTrack;
  return {
    url: info.url,
    title: info.name,
    duration: formatDuration(info.durationInMs),
    durationMs: info.durationInMs,
    source: 'soundcloud',
    thumbnail: info.thumbnail,
    author: info.user?.name,
    requestedBy,
  };
}

async function resolveSoundcloudPlaylist(url: string, requestedBy: string): Promise<Track[]> {
  const info = (await play.soundcloud(url)) as SoundCloudPlaylist;
  const tracks = info.tracks as SoundCloudTrack[];
  return tracks.map((t) => ({
    url: t.url ?? t.permalink,
    title: t.name ?? 'Unknown',
    duration: formatDuration(t.durationInMs ?? 0),
    durationMs: t.durationInMs ?? 0,
    source: 'soundcloud' as TrackSource,
    thumbnail: t.thumbnail,
    author: t.user?.name,
    requestedBy,
  }));
}
