export type TrackSource = 'youtube';

export interface Track {
  url: string;
  title: string;
  duration: string;
  durationMs: number;
  source: TrackSource;
  thumbnail?: string;
  author?: string;
  requestedBy: string;
  needsAuth?: boolean;
}
