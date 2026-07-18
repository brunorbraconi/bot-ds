import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionStatus,
  StreamType,
} from '@discordjs/voice';
import { Track } from './Track';
import { logger } from '../utils/logger';
import { client } from '../client';
import { spawn } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import ytDlpExec from 'youtube-dl-exec';

const IDLE_TIMEOUT_MS = 60_000;
const CONNECT_TIMEOUT_MS = 30_000;

export type LoopMode = 'none' | 'track' | 'queue';

export class GuildPlayer {
  private queue: Track[] = [];
  private currentTrack: Track | null = null;
  private loopMode: LoopMode = 'none';
  private volumeLevel: number = 50;
  private player: AudioPlayer;
  private connection: VoiceConnection | null = null;
  private isDestroyed = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private onIdle: (() => void) | null = null;
  private currentProcess: { yt?: any; ff?: any } | null = null;

  readonly guildId: string;

  constructor(guildId: string, onIdle: () => void) {
    this.guildId = guildId;
    this.onIdle = onIdle;
    this.player = createAudioPlayer();

    this.player.on(AudioPlayerStatus.Playing, () => {
      logger.info(`[${guildId}] Player: Playing`);
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      logger.info(`[${guildId}] Player: Idle`);
      this.handleTrackEnd();
    });

    this.player.on(AudioPlayerStatus.AutoPaused, () => {
      logger.info(`[${guildId}] Player: AutoPaused`);
    });

    this.player.on('error', (err) => {
      logger.error(`[${this.guildId}] Player error:`, err.message);
      this.handleTrackEnd();
    });
  }

  get queueSize(): number { return this.queue.length; }
  get current(): Track | null { return this.currentTrack; }
  get loop(): LoopMode { return this.loopMode; }
  get volume(): number { return this.volumeLevel; }
  get allTracks(): Track[] { return [...this.queue]; }

  async connect(channelId: string): Promise<void> {
    const guild = client.guilds.cache.get(this.guildId);
    if (!guild) throw new Error('Guild not found');

    logger.info(`[${this.guildId}] Connecting to voice channel ${channelId}`);

    this.connection = joinVoiceChannel({
      channelId,
      guildId: this.guildId,
      adapterCreator: guild.voiceAdapterCreator,
    });

    this.connection.on('debug', (msg) => {
      logger.debug(`[${this.guildId}] Voice debug: ${msg}`);
    });

    this.connection.on('stateChange', (oldState, newState) => {
      logger.info(`[${this.guildId}] Connection: ${oldState.status} -> ${newState.status}`);
    });

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      logger.info(`[${this.guildId}] Connection: Disconnected`);
      try {
        await entersState(this.connection!, VoiceConnectionStatus.Connecting, 5_000);
      } catch {
        this.destroy();
      }
    });

    this.connection.on(VoiceConnectionStatus.Ready, () => {
      logger.info(`[${this.guildId}] === Voice Connection READY ===`);
    });

    this.connection.subscribe(this.player);
    logger.info(`[${this.guildId}] Player subscribed`);
  }

  disconnect(): void {
    this.killProcess();
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.player.stop(true);
    this.connection?.destroy();
    this.connection = null;
  }

  destroy(): void {
    this.isDestroyed = true;
    this.queue = [];
    this.currentTrack = null;
    this.disconnect();
    this.player.removeAllListeners();
    this.onIdle = null;
  }

  addTrack(track: Track): void { this.queue.push(track); }
  addTracks(tracks: Track[]): void { this.queue.push(...tracks); }

  async playNow(): Promise<void> {
    if (this.currentTrack && this.player.state.status !== AudioPlayerStatus.Idle) return;
    this.processQueue();
  }

  skip(): Track | null {
    const prev = this.currentTrack;
    if (prev) { this.player.stop(true); return prev; }
    return null;
  }

  stop(): void {
    this.queue = [];
    this.currentTrack = null;
    this.player.stop(true);
    this.disconnect();
  }

  shuffle(): void {
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
  }

  setLoop(mode: LoopMode): void { this.loopMode = mode; }
  setVolume(level: number): void { this.volumeLevel = Math.max(0, Math.min(100, level)); }
  removeTrack(index: number): Track | null {
    if (index < 0 || index >= this.queue.length) return null;
    return this.queue.splice(index, 1)[0];
  }
  clearQueue(): void { this.queue = []; }

  private killProcess(): void {
    if (this.currentProcess) {
      try { this.currentProcess.yt?.kill('SIGKILL'); } catch {}
      try { this.currentProcess.ff?.kill('SIGKILL'); } catch {}
      this.currentProcess = null;
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isDestroyed) return;
    if (this.queue.length === 0 || !this.connection) {
      this.startIdleTimer();
      return;
    }
    this.stopIdleTimer();
    const track = this.queue.shift()!;
    this.currentTrack = track;
    try {
      await this.playTrack(track);
    } catch (err) {
      logger.error(`[${this.guildId}] Failed to play track:`, err);
      this.currentTrack = null;
      this.processQueue();
    }
  }

  private async playTrack(track: Track): Promise<void> {
    await this.waitForReady();

    const ffmpegPath = ffmpegStatic as string;
    if (!ffmpegPath) throw new Error('ffmpeg-static path not found');

    logger.info(`[${this.guildId}] Spawning yt-dlp for: ${track.url}`);

    const yt = ytDlpExec.exec(track.url, {
      format: 'bestaudio[ext=m4a]/bestaudio',
      output: '-',
      noWarnings: true,
      noCheckCertificates: true,
    });

    const ff = spawn(ffmpegPath, [
      '-analyzeduration', '0',
      '-loglevel', '0',
      '-i', 'pipe:0',
      '-f', 'opus',
      '-ar', '48000',
      '-ac', '2',
      'pipe:1',
    ], { windowsHide: true });

    this.currentProcess = { yt, ff };
    yt.stdout?.pipe(ff.stdin);

    if (yt.stderr) {
      yt.stderr.on('data', (d: Buffer) => {
        const msg = d.toString().trim();
        if (msg) logger.debug(`[yt-dlp] ${msg}`);
      });
    }
    yt.on('error', (err: Error) => logger.error(`[${this.guildId}] yt-dlp:`, err.message));

    ff.stderr.on('data', (d: Buffer) => {
      const msg = d.toString().trim();
      if (msg) logger.debug(`[ffmpeg] ${msg}`);
    });
    ff.on('error', (err: Error) => logger.error(`[${this.guildId}] ffmpeg:`, err.message));

    const resource = createAudioResource(ff.stdout, {
      inputType: StreamType.OggOpus,
      inlineVolume: this.volumeLevel !== 50,
    });

    if (this.volumeLevel !== 50 && resource.volume) {
      resource.volume.setVolume(this.volumeLevel / 100);
    }

    this.player.play(resource);
  }

  private async waitForReady(): Promise<void> {
    if (!this.connection) throw new Error('No voice connection');

    if (this.connection.state.status === VoiceConnectionStatus.Ready) return;
    if (this.connection.state.status === VoiceConnectionStatus.Disconnected) {
      throw new Error('Voice connection is disconnected');
    }

    logger.info(`[${this.guildId}] Waiting for voice connection (state: ${this.connection.state.status})`);

    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, CONNECT_TIMEOUT_MS);
      logger.info(`[${this.guildId}] Connection ready after wait`);
    } catch {
      logger.warn(`[${this.guildId}] Connection still not ready after ${CONNECT_TIMEOUT_MS}ms (state: ${this.connection.state.status})`);
    }
  }

  private handleTrackEnd(): void {
    const finished = this.currentTrack;
    this.currentTrack = null;
    this.killProcess();
    if (this.isDestroyed) return;
    if (this.loopMode === 'track' && finished) this.queue.unshift(finished);
    else if (this.loopMode === 'queue' && finished) this.queue.push(finished);
    this.processQueue();
  }

  private startIdleTimer(): void {
    if (this.idleTimer) return;
    this.idleTimer = setTimeout(() => {
      this.onIdle?.();
      this.destroy();
    }, IDLE_TIMEOUT_MS);
  }

  private stopIdleTimer(): void {
    if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; }
  }
}
