import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { Readable } from 'stream';
import play from 'play-dl';
import { Track } from './Track';
import { logger } from '../utils/logger';
import { client } from '../client';

const IDLE_TIMEOUT_MS = 60_000;

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

  readonly guildId: string;

  constructor(guildId: string, onIdle: () => void) {
    this.guildId = guildId;
    this.onIdle = onIdle;
    this.player = createAudioPlayer();

    this.player.on(AudioPlayerStatus.Playing, () => {
      logger.debug(`[${guildId}] Player started playing`);
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      this.handleTrackEnd();
    });

    this.player.on('error', (err) => {
      logger.error(`[${guildId}] Player error:`, err.message);
      this.handleTrackEnd();
    });
  }

  get queueSize(): number {
    return this.queue.length;
  }

  get current(): Track | null {
    return this.currentTrack;
  }

  get loop(): LoopMode {
    return this.loopMode;
  }

  get volume(): number {
    return this.volumeLevel;
  }

  get allTracks(): Track[] {
    return [...this.queue];
  }

  async connect(channelId: string): Promise<void> {
    const guild = client.guilds.cache.get(this.guildId);
    if (!guild) throw new Error('Guild not found');

    this.connection = joinVoiceChannel({
      channelId,
      guildId: this.guildId,
      adapterCreator: guild.voiceAdapterCreator,
    });

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await entersState(this.connection!, VoiceConnectionStatus.Connecting, 5_000);
      } catch {
        this.destroy();
      }
    });

    this.connection.subscribe(this.player);
  }

  disconnect(): void {
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

  addTrack(track: Track): void {
    this.queue.push(track);
  }

  addTracks(tracks: Track[]): void {
    this.queue.push(...tracks);
  }

  async playNow(): Promise<void> {
    if (this.currentTrack && this.player.state.status !== AudioPlayerStatus.Idle) return;
    this.processQueue();
  }

  skip(): Track | null {
    const prev = this.currentTrack;
    if (prev) {
      this.player.stop(true);
      return prev;
    }
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

  setLoop(mode: LoopMode): void {
    this.loopMode = mode;
  }

  setVolume(level: number): void {
    this.volumeLevel = Math.max(0, Math.min(100, level));
    const resource = this.player.state.status === AudioPlayerStatus.Playing
      ? (this.player.state as { resource: AudioResource }).resource
      : null;
    if (resource && resource.volume) {
      resource.volume.setVolume(this.volumeLevel / 100);
    }
  }

  removeTrack(index: number): Track | null {
    if (index < 0 || index >= this.queue.length) return null;
    return this.queue.splice(index, 1)[0];
  }

  clearQueue(): void {
    this.queue = [];
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
    const result = await play.stream(track.url);
    const resource = createAudioResource(result.stream as unknown as Readable, {
      inputType: result.type as any,
      inlineVolume: true,
    });
    resource.volume?.setVolume(this.volumeLevel / 100);
    this.player.play(resource);
  }

  private handleTrackEnd(): void {
    const finished = this.currentTrack;
    this.currentTrack = null;

    if (this.isDestroyed) return;

    if (this.loopMode === 'track' && finished) {
      this.queue.unshift(finished);
    } else if (this.loopMode === 'queue' && finished) {
      this.queue.push(finished);
    }

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
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}
