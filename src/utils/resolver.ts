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
  formats?: { format_id?: string; acodec?: string; vcodec?: string }[];
}

const YT_DLP = require('youtube-dl-exec').constants.YOUTUBE_DL_PATH;
const BASE_FLAGS = ['--dump-single-json', '--no-warnings', '--no-check-certificate', '--flat-playlist', '--ignore-no-formats-error'];
const MAX_PLAYLIST_ITEMS = 500;

export class AgeRestrictedError extends Error {}

function getAuthFlags(): string[] {
  const flags: string[] = [];
  const browser = process.env.YT_COOKIES_FROM_BROWSER;
  if (browser) flags.push('--cookies-from-browser', browser);
  const cookies = process.env.YT_COOKIES_PATH;
  if (cookies) flags.push('--cookies', cookies);
  return flags;
}

export function hasAuth(): boolean {
  return Boolean(process.env.YT_COOKIES_FROM_BROWSER || process.env.YT_COOKIES_PATH);
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function hasPlayableAudio(info: YTResult): boolean {
  if (!Array.isArray(info.formats) || info.formats.length === 0) return true;
  return info.formats.some((f) => f.acodec && f.acodec !== 'none');
}

function isAgeRestrictedError(stderr: string): boolean {
  return /confirm your age|age-restricted|inappropriate|Sign in to confirm/i.test(stderr);
}

function runYtDlp(url: string, useAuth = false): Promise<YTResult> {
  return new Promise((resolve, reject) => {
    const flags = useAuth ? [...BASE_FLAGS, ...getAuthFlags()] : BASE_FLAGS;
    const proc = spawn(YT_DLP, [url, ...flags], {
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
        const msg = stderr.slice(0, 200);
        if (isAgeRestrictedError(msg)) {
          reject(new AgeRestrictedError(msg));
          return;
        }
        reject(new Error(`yt-dlp exited with code ${code}: ${msg}`));
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
  if (/^https?:\/\//.test(query)) {
    const target = normalizeUrl(query);

    let info: YTResult;
    let usedAuth = false;
    try {
      info = await runYtDlp(target);
    } catch (err) {
      if (err instanceof AgeRestrictedError && hasAuth()) {
        usedAuth = true;
        try {
          info = await runYtDlp(target, true);
        } catch (retryErr) {
          if (retryErr instanceof AgeRestrictedError) {
            throw new Error('No se pudo verificar la edad del video aun con cookies. Revisa que las cookies sean válidas.');
          }
          throw retryErr;
        }
      } else if (err instanceof AgeRestrictedError) {
        throw new Error('Este video está restringido por edad. Configuralo en el .env con YT_COOKIES_PATH o YT_COOKIES_FROM_BROWSER.');
      } else {
        throw err;
      }
    }

    if (info._type === 'playlist' || info._type === 'url_playlist') {
      const tracks = playlistTracks(info, requestedBy);
      if (tracks.length === 0) throw new Error('La playlist está vacía.');
      return tracks;
    }

    if (!hasPlayableAudio(info)) {
      throw new Error('Este video no tiene audio disponible para reproducir (posiblemente esté bloqueado o sea inválido).');
    }

    return {
      url: query,
      title: info.title ?? 'Unknown',
      duration: formatDuration(info.duration ?? 0),
      durationMs: (info.duration ?? 0) * 1000,
      source: 'youtube',
      thumbnail: info.thumbnail,
      author: info.channel ?? info.uploader,
      requestedBy,
      needsAuth: usedAuth,
    };
  }

  // Search query
  const searchResult = await runYtDlp(`ytsearch1:${query}`);
  const entries = searchResult.entries;
  if (!entries || entries.length === 0) throw new Error('No se encontraron resultados.');

  const first = entries[0];
  const videoUrl = first.webpage_url || first.url;
  if (!videoUrl) throw new Error('No se pudo obtener la URL del video.');

  let info: YTResult;
  let usedAuth = false;
  try {
    info = await runYtDlp(videoUrl);
  } catch (err) {
    if (err instanceof AgeRestrictedError && hasAuth()) {
      usedAuth = true;
      try {
        info = await runYtDlp(videoUrl, true);
      } catch (retryErr) {
        if (retryErr instanceof AgeRestrictedError) {
          throw new Error('No se pudo verificar la edad del video aun con cookies. Revisa que las cookies sean válidas.');
        }
        throw retryErr;
      }
    } else if (err instanceof AgeRestrictedError) {
      throw new Error('Este video está restringido por edad. Configuralo en el .env con YT_COOKIES_PATH o YT_COOKIES_FROM_BROWSER.');
    } else {
      throw err;
    }
  }

  if (!hasPlayableAudio(info)) {
    throw new Error('Este video no tiene audio disponible para reproducir (posiblemente esté bloqueado o sea inválido).');
  }

  return {
    url: videoUrl,
    title: info.title ?? first.title ?? 'Unknown',
    duration: formatDuration(info.duration ?? 0),
    durationMs: (info.duration ?? 0) * 1000,
    source: 'youtube',
    thumbnail: info.thumbnail,
    author: info.channel ?? info.uploader,
    requestedBy,
    needsAuth: usedAuth,
  };
}

export async function searchYoutube(query: string, limit: number = 10): Promise<YTEntry[]> {
  const result = await runYtDlp(`ytsearch${limit}:${query}`);
  return result.entries || [];
}