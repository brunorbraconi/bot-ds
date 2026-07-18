export type TrackSource = 'youtube' | 'soundcloud';

export interface Track {
  url: string;
  title: string;
  duration: string;
  durationMs: number;
  source: TrackSource;
  thumbnail?: string;
  author?: string;
  requestedBy: string;
}
