import { AudioBus, AudioLoader, AudioMixer, Sound } from '../core';
import { GameStorage } from '../game';
import * as config from '../config';

// Sounds routed to the "music" (ambient) bus; everything else defaults to the
// "sfx" bus so impacts and ambience can be balanced independently.
const MUSIC_SOUND_IDS = ['level-intro', 'pause', 'tank.idle', 'tank.move'];

export class AudioManager {
  private audioLoader: AudioLoader;
  private storage: GameStorage;
  private globalMuted = false;
  private masterVolume = config.AUDIO_MASTER_VOLUME;
  private readonly mixer: AudioMixer;
  private readonly musicElements = new Set<HTMLMediaElement>();

  constructor(audioLoader: AudioLoader, storage: GameStorage) {
    this.audioLoader = audioLoader;
    this.storage = storage;

    this.mixer = new AudioMixer(this.masterVolume, config.AUDIO_MASTER_INTENSITY);
    this.mixer.setBusVolume('sfx', config.AUDIO_SFX_VOLUME);
    this.mixer.setBusVolume('music', config.AUDIO_MUSIC_VOLUME);

    // Resolve which elements belong on the music bus up front so the loaded
    // handler can route them without needing the sound id.
    MUSIC_SOUND_IDS.forEach((id) => {
      try {
        this.musicElements.add(this.audioLoader.load(id).audioElement);
      } catch {
        // Missing manifest entry — skip; it just stays on the default bus.
      }
    });

    this.audioLoader.loaded.addListener((sound) => {
      sound.setGlobalMuted(this.globalMuted);
      this.mixer.connect(sound.audioElement, this.busFor(sound));
    });

    // Route anything that finished loading before this listener was attached.
    this.audioLoader.getAllLoaded().forEach((sound) => {
      this.mixer.connect(sound.audioElement, this.busFor(sound));
    });
  }

  private busFor(sound: Sound): AudioBus {
    return this.musicElements.has(sound.audioElement) ? 'music' : 'sfx';
  }

  public setGlobalMuted(isGlobalMuted: boolean): void {
    this.globalMuted = isGlobalMuted;

    this.mixer.setMuted(isGlobalMuted);

    const sounds = this.getLoadedSounds();
    sounds.forEach((sound) => {
      sound.setGlobalMuted(isGlobalMuted);
    });
  }

  public isGlobalMuted(): boolean {
    return this.globalMuted;
  }

  // Master output level in [0..1]. Persisted; layered under the fixed
  // reduced-audio intensity scalar inside the mixer.
  public setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.mixer.setMasterVolume(this.masterVolume);
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public play(soundId: string): void {
    this.mixer.resume();
    const sound = this.audioLoader.load(soundId);
    sound.play();
  }

  public playLoop(soundId: string): void {
    this.mixer.resume();
    const sound = this.audioLoader.load(soundId);
    sound.playLoop();
  }

  public stop(soundId: string): void {
    const sound = this.audioLoader.load(soundId);
    sound.stop();
  }

  public pauseAll(): void {
    const sounds = this.getLoadedSounds();
    sounds.forEach((sound) => {
      sound.pause();
    });
  }

  public resumeAll(): void {
    const sounds = this.getLoadedSounds();
    sounds.forEach((sound) => {
      if (sound.canResume()) {
        sound.resume();
      }
    });
  }

  public stopAll(): void {
    const sounds = this.getLoadedSounds();
    sounds.forEach((sound) => {
      sound.stop();
    });
  }

  public muteAllExcept(...exceptSounds: Sound[]): void {
    const sounds = this.getLoadedSounds();
    sounds.forEach((sound) => {
      if (!exceptSounds.includes(sound)) {
        sound.setMuted(true);
      }
    });
  }

  public unmuteAll(): void {
    const sounds = this.getLoadedSounds();
    sounds.forEach((sound) => {
      sound.setMuted(false);
    });
  }

  public loadSettings(): void {
    this.globalMuted = this.storage.getBoolean(
      config.STORAGE_KEY_SETTINGS_AUDIO_MUTED,
      false,
    );
    this.mixer.setMuted(this.globalMuted);

    this.masterVolume = this.storage.getNumber(
      config.STORAGE_KEY_SETTINGS_AUDIO_VOLUME,
      config.AUDIO_MASTER_VOLUME,
    );
    this.mixer.setMasterVolume(this.masterVolume);
  }

  public saveSettings(): void {
    this.storage.setBoolean(
      config.STORAGE_KEY_SETTINGS_AUDIO_MUTED,
      this.globalMuted,
    );
    this.storage.setNumber(
      config.STORAGE_KEY_SETTINGS_AUDIO_VOLUME,
      this.masterVolume,
    );
    this.storage.save();
  }

  private getLoadedSounds(): Sound[] {
    return this.audioLoader.getAllLoaded();
  }
}
