import type { HighwayPart, MidiSong, PartSongAssignment } from '../../shared/types';
import type { RoadSystem } from '../road/RoadSystem';
import * as MidiPlayer from './MidiPlayer';

interface ResolvedPart {
  id: string;
  roadId: string;
  startT: number;
  songIds: string[];
}

export class MusicManager {
  private partsByRoad: Map<string, ResolvedPart[]>;
  private songsById: Map<string, MidiSong>;
  private roadSystem: RoadSystem;

  private currentPartId: string | null = null;
  private currentSongId: string | null = null;
  private audioStarted = false;
  private loading = false;

  // Fade state
  private fadingOut = false;
  private fadeVolume = -6;
  private targetVolume = -6;
  private pendingSongUrl: string | null = null;

  constructor(
    parts: HighwayPart[],
    songs: MidiSong[],
    partSongs: PartSongAssignment[],
    roadSystem: RoadSystem,
  ) {
    this.roadSystem = roadSystem;
    this.songsById = new Map(songs.map((s) => [s.id, s]));

    // Build song lists per part
    const songsByPart = new Map<string, string[]>();
    for (const ps of partSongs) {
      if (!songsByPart.has(ps.partId)) songsByPart.set(ps.partId, []);
      songsByPart.get(ps.partId)!.push(ps.songId);
    }

    // Group parts by road, sorted by startT
    this.partsByRoad = new Map();
    for (const part of parts) {
      if (!this.partsByRoad.has(part.roadId)) this.partsByRoad.set(part.roadId, []);
      this.partsByRoad.get(part.roadId)!.push({
        id: part.id,
        roadId: part.roadId,
        startT: part.startT,
        songIds: songsByPart.get(part.id) ?? [],
      });
    }
    for (const [, roadParts] of this.partsByRoad) {
      roadParts.sort((a, b) => a.startT - b.startT);
    }
  }

  private findPartAtPosition(roadId: string, t: number): ResolvedPart | null {
    const roadParts = this.partsByRoad.get(roadId);
    if (!roadParts || roadParts.length === 0) return null;

    const road = this.roadSystem.getRoad(roadId);
    const isCyclic = road?.isCyclic ?? false;

    // For cyclic: find the part whose range contains t
    // For open: find the last part with startT <= t
    // Parts are sorted by startT. Part i covers [startT_i, startT_{i+1})
    // Last part covers [startT_last, 1.0) for open, or wraps to [startT_last, startT_0) for cyclic

    let found: ResolvedPart | null = null;
    for (let i = roadParts.length - 1; i >= 0; i--) {
      if (t >= roadParts[i].startT) {
        found = roadParts[i];
        break;
      }
    }

    // If t < first part's startT: on cyclic roads, wrap to last part
    if (!found && isCyclic && roadParts.length > 0) {
      found = roadParts[roadParts.length - 1];
    }

    return found;
  }

  private pickRandomSong(songIds: string[]): MidiSong | null {
    // Filter to only songs that exist and aren't the current one
    const available = songIds
      .filter((id) => id !== this.currentSongId && this.songsById.has(id))
      .map((id) => this.songsById.get(id)!);

    if (available.length === 0) {
      // Fall back to any song in the pool (including current)
      const all = songIds
        .filter((id) => this.songsById.has(id))
        .map((id) => this.songsById.get(id)!);
      if (all.length === 0) return null;
      return all[Math.floor(Math.random() * all.length)];
    }

    return available[Math.floor(Math.random() * available.length)];
  }

  /** Call after user gesture has started the AudioContext. */
  enable() {
    this.audioStarted = true;
  }

  async update(currentPosition: { roadId: string; t: number }) {
    if (!this.audioStarted) return;
    const part = this.findPartAtPosition(currentPosition.roadId, currentPosition.t);
    const partId = part?.id ?? null;

    // Same part — nothing to do
    if (partId === this.currentPartId) return;

    this.currentPartId = partId;

    if (!part || part.songIds.length === 0) {
      // Entered a zone with no music — fade out
      if (MidiPlayer.getIsPlaying()) {
        this.fadeOutAndStop();
      }
      this.currentSongId = null;
      return;
    }

    // Pick a random song and play it
    const song = this.pickRandomSong(part.songIds);
    if (!song) return;

    this.currentSongId = song.id;
    const url = `/assets/midi/${song.filePath}`;

    if (MidiPlayer.getIsPlaying()) {
      // Crossfade: fade out current, then start new
      this.pendingSongUrl = url;
      this.fadeOutAndStop();
    } else {
      await this.startSong(url);
    }
  }

  private fadeOutAndStop() {
    this.fadingOut = true;
    this.targetVolume = -60;
  }

  private async startSong(url: string) {
    if (this.loading) return;
    this.loading = true;

    try {
      await MidiPlayer.loadMidi(url);
      this.fadeVolume = -6;
      this.targetVolume = -6;
      MidiPlayer.setVolume(this.fadeVolume);
      MidiPlayer.play();
    } catch (err) {
      console.error('Failed to load MIDI:', err);
    } finally {
      this.loading = false;
    }
  }

  /** Call from animation loop to drive volume fades. */
  tick(dt: number) {
    if (!this.fadingOut) return;

    const FADE_SPEED = 30; // dB per second
    this.fadeVolume = Math.max(this.targetVolume, this.fadeVolume - FADE_SPEED * dt);
    MidiPlayer.setVolume(this.fadeVolume);

    if (this.fadeVolume <= -59) {
      MidiPlayer.stop();
      this.fadingOut = false;
      this.fadeVolume = -6;
      MidiPlayer.setVolume(this.fadeVolume);

      // If there's a pending song, start it
      if (this.pendingSongUrl) {
        const url = this.pendingSongUrl;
        this.pendingSongUrl = null;
        this.startSong(url);
      }
    }
  }

  dispose() {
    MidiPlayer.stop();
  }
}
