import { spawn } from 'child_process';
import { Track, TrackSource } from '../music/Track';

interface YTEntry {
  title?: string;
  url?: string;
  webpage_url?: string;
  duration?: number;
  thumbnail?: string;
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

export async function resolveTrack(
  query: string,
  requestedBy: string
): Promise<Track | Track[]> {
  const baseFlags = [...FLAGS];

  if (/^https?:\/\//.test(query)) {
    const result = await runYtDlp(query);

    if (result._type === 'playlist' || result._type === 'url_playlist') {
      const entries = result.entries || [];
      if (entries.length === 0) throw new Error('La playlist está vacía.');

      return Promise.all(
        entries.map(async (entry: YTEntry) => {
          const videoUrl = entry.webpage_url || entry.url;
          if (!videoUrl) return null;
          try {
            const info = await runYtDlp(videoUrl);
            return {
              url: videoUrl,
              title: entry.title ?? info.title ?? 'Unknown',
              duration: formatDuration(info.duration ?? 0),
              durationMs: (info.duration ?? 0) * 1000,
              source: 'youtube' as TrackSource,
              thumbnail: info.thumbnail,
              author: info.channel ?? info.uploader,
              requestedBy,
            } as Track;
          } catch {
            return {
              url: videoUrl,
              title: entry.title ?? 'Unknown',
              duration: '0:00',
              durationMs: 0,
              source: 'youtube' as TrackSource,
              requestedBy,
            } as Track;
          }
        })
      ).then((tracks) => tracks.filter(Boolean) as Track[]);
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
