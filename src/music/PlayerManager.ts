import { GuildPlayer } from './GuildPlayer';

class PlayerManager {
  private players = new Map<string, GuildPlayer>();

  get(guildId: string): GuildPlayer | undefined {
    return this.players.get(guildId);
  }

  create(guildId: string): GuildPlayer {
    const existing = this.players.get(guildId);
    if (existing) return existing;

    const player = new GuildPlayer(guildId, () => {
      this.players.delete(guildId);
    });
    this.players.set(guildId, player);
    return player;
  }

  destroy(guildId: string): void {
    const player = this.players.get(guildId);
    if (player) {
      player.destroy();
      this.players.delete(guildId);
    }
  }

  has(guildId: string): boolean {
    return this.players.has(guildId);
  }
}

export const playerManager = new PlayerManager();
