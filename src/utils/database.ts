import Database from 'better-sqlite3';
import path from 'path';
import { Track } from '../music/Track';
import { logger } from './logger';

const DB_PATH = path.resolve(process.cwd(), 'playlists.db');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    tracks TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, name)
  )
`);

export function savePlaylist(guildId: string, name: string, tracks: Track[]): void {
  const stmt = db.prepare('INSERT OR REPLACE INTO playlists (guild_id, name, tracks) VALUES (?, ?, ?)');
  stmt.run(guildId, name, JSON.stringify(tracks));
  logger.info(`Playlist "${name}" saved for guild ${guildId}`);
}

export function loadPlaylist(guildId: string, name: string): Track[] | null {
  const stmt = db.prepare('SELECT tracks FROM playlists WHERE guild_id = ? AND name = ?');
  const row = stmt.get(guildId, name) as { tracks: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.tracks) as Track[];
}

export function listPlaylists(guildId: string): string[] {
  const stmt = db.prepare('SELECT name FROM playlists WHERE guild_id = ? ORDER BY created_at DESC');
  const rows = stmt.all(guildId) as { name: string }[];
  return rows.map((r) => r.name);
}

export function deletePlaylist(guildId: string, name: string): boolean {
  const stmt = db.prepare('DELETE FROM playlists WHERE guild_id = ? AND name = ?');
  const result = stmt.run(guildId, name);
  return result.changes > 0;
}

export function closeDb(): void {
  db.close();
}
