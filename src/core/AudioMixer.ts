// Volume-mixing layer sitting under the HTMLAudioElement-based Sound/
// AudioLoader system. Each connected element's `.volume` is driven by:
//
//   effective = masterVolume * masterIntensity * busVolume[bus]
//
// This gives independent per-bus volume and a single master "intensity"
// scalar (e.g. a reduced-audio switch) without touching individual sounds.
// It is purely presentational — no simulation state, no rng — so it can't
// affect replay determinism.
//
// Deliberately NOT implemented via real Web Audio (AudioContext + gain
// nodes): routing an <audio> element through a MediaElementAudioSourceNode
// permanently and irreversibly severs its native output for that element's
// whole lifetime, and a fresh AudioContext stays "suspended" (silent) until a
// genuine user gesture resumes it. Since connecting happens automatically at
// app startup — before any gesture — that combination made every sound
// silent. Plain element.volume control needs no audio graph and no gesture,
// so it always works.

export type AudioBus = 'sfx' | 'music';

const CLAMP = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

export class AudioMixer {
  private elementBus = new Map<HTMLMediaElement, AudioBus>();

  private masterVolume: number;
  private masterIntensity: number;
  private busVolumes: Record<AudioBus, number> = { sfx: 1, music: 1 };
  private muted = false;

  constructor(masterVolume = 1, masterIntensity = 1) {
    this.masterVolume = CLAMP(masterVolume);
    this.masterIntensity = CLAMP(masterIntensity);
  }

  // Route a sound's audio element onto the given bus. Idempotent; re-calling
  // with a different bus moves the sound. Safe to call before the element has
  // loaded.
  public connect(element: HTMLMediaElement, bus: AudioBus = 'sfx'): void {
    this.elementBus.set(element, bus);
    this.applyElementVolume(element);
  }

  // No audio graph to resume — kept as a no-op so call sites around playback
  // (e.g. on user gesture) don't need to change.
  public resume(): void {
    return undefined;
  }

  public setMasterVolume(volume: number): void {
    this.masterVolume = CLAMP(volume);
    this.applyAll();
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  // Overall output scalar layered on top of the master volume — the reduced-
  // audio / low-end knob, analogous to PARTICLE_INTENSITY for particles.
  public setMasterIntensity(intensity: number): void {
    this.masterIntensity = CLAMP(intensity);
    this.applyAll();
  }

  public setBusVolume(bus: AudioBus, volume: number): void {
    this.busVolumes[bus] = CLAMP(volume);
    this.applyAll();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyAll();
  }

  private applyAll(): void {
    this.elementBus.forEach((_bus, element) => {
      this.applyElementVolume(element);
    });
  }

  private applyElementVolume(element: HTMLMediaElement): void {
    const bus = this.elementBus.get(element) ?? 'sfx';
    element.volume = this.muted
      ? 0
      : CLAMP(this.masterVolume * this.masterIntensity * this.busVolumes[bus]);
  }
}
