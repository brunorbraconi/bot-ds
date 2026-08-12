import { spawn } from 'child_process';
import { Track, TrackSource } from '../music/Track';

interface YTThumbnail {
  url?: string;
}

interface YTEntry {
  id?: string;
  title?: string;
  url?: string;
  webpage_url?: string;
  duration?: number;
  thumbnail?: string;
  thumbnails?: YTThumbnail[];
  channel?: string;
  uploader?: string;
}

interface YTResult {
  _type?: string;
  title?: string;
  duration?: number;
  thumbnail?: string;
  channel?: string;
  uploader?: string;
  entries?: YTEntry[];
}

const YT_DLP = require('youtube-dl-exec').constants.YOUTUBE_DL_PATH;
const FLAGS = ['--dump-single-json', '--no-warnings', '--no-check-certificate', '--flat-playlist'];
const MAX_PLAYLIST_ITEMS = 500;

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function runYtDlp(url: string): Promise<YTResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(YT_DLP, [url, ...FLAGS], {
      windowsHide: true,
      timeout: 30_000,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp exited with code ${code}: ${stderr.slice(0, 200)}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error('Failed to parse yt-dlp output'));
      }
    });
  });
}

function isVideoHost(hostname: string): boolean {
  return (
    hostname === 'youtu.be' ||
    hostname === 'www.youtube.com' ||
    hostname === 'm.youtube.com' ||
    hostname === 'music.youtube.com' ||
    hostname.endsWith('.youtube.com')
  );
}

/**
 * YouTube (youtu.be / www.youtube.com / m.youtube.com / music.youtube.com) trata el
 * parametro `list` como contexto de playlist aunque el usuario solo haya compartido un
 * video. Para esos enlaces (tienen `v=` o son youtu.be) quitamos `list`, `start_radio`
 * e `index` y resolvemos el video en solitario. Los enlaces de playlist reales
 * (playlist?list=...) se dejan intactos.
 */
function normalizeUrl(query: string): string {
  const u = new URL(query);
  if (!isVideoHost(u.hostname)) return query;
  if (u.hostname !== 'youtu.be' && !u.searchParams.has('v')) return query;
  for (const p of ['list', 'start_radio', 'index']) u.searchParams.delete(p);
  return u.toString();
}

function playlistTracks(result: YTResult, requestedBy: string): Track[] {
  const entries = (result.entries || []).slice(0, MAX_PLAYLIST_ITEMS);
  return entries
    .map((entry: YTEntry) => {
      const videoUrl = entry.webpage_url || entry.url;
      if (!videoUrl) return null;
      return {
        url: videoUrl,
        title: entry.title ?? 'Unknown',
        duration: formatDuration(entry.duration ?? 0),
        durationMs: (entry.duration ?? 0) * 1000,
        source: 'youtube' as TrackSource,
        thumbnail: entry.thumbnail || entry.thumbnails?.[0]?.url || (entry.id ? `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg` : undefined),
        author: entry.channel ?? entry.uploader,
        requestedBy,
      } as Track;
    })
    .filter(Boolean) as Track[];
}

export async function resolveTrack(
  query: string,
  requestedBy: string
): Promise<Track | Track[]> {
  const baseFlags = [...FLAGS];

  if (/^https?:\/\//.test(query)) {
    const target = normalizeUrl(query);
    const result = await runYtDlp(target);

    if (result._type === 'playlist' || result._type === 'url_playlist') {
      const tracks = playlistTracks(result, requestedBy);
      if (tracks.length === 0) throw new Error('La playlist está vacía.');
      return tracks;
    }

    return {
      url: query,
      title: result.title ?? 'Unknown',
      duration: formatDuration(result.duration ?? 0),
      durationMs: (result.duration ?? 0) * 1000,
      source: 'youtube',
      thumbnail: result.thumbnail,
      author: result.channel ?? result.uploader,
      requestedBy,
    };
  }

  // Search query
  const searchResult = await runYtDlp(`ytsearch1:${query}`);
  const entries = searchResult.entries;
  if (!entries || entries.length === 0) throw new Error('No se encontraron resultados.');

  const first = entries[0];
  const videoUrl = first.webpage_url || first.url;
  if (!videoUrl) throw new Error('No se pudo obtener la URL del video.');

  const info = await runYtDlp(videoUrl);

  return {
    url: videoUrl,
    title: info.title ?? first.title ?? 'Unknown',
    duration: formatDuration(info.duration ?? 0),
    durationMs: (info.duration ?? 0) * 1000,
    source: 'youtube',
    thumbnail: info.thumbnail,
    author: info.channel ?? info.uploader,
    requestedBy,
  };
}

export async function searchYoutube(query: string, limit: number = 10): Promise<YTEntry[]> {
  const result = await runYtDlp(`ytsearch${limit}:${query}`);
  return result.entries || [];
}