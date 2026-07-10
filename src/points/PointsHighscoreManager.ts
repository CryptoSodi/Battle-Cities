import { GameStorage } from '../game';
import { apiFetch } from '../network/api';
import * as config from '../config';

export class PointsHighscoreManager {
  private storage: GameStorage;

  constructor(storage: GameStorage) {
    this.storage = storage;
  }

  public getPrimaryPoints(): number {
    const points = this.storage.getNumber(
      config.STORAGE_KEY_POINTS_HIGHSCORE_PRIMARY,
      0,
    );
    return points;
  }

  public savePrimaryPoints(points: number): void {
    this.storage.setNumber(config.STORAGE_KEY_POINTS_HIGHSCORE_PRIMARY, points);
    this.storage.save();
  }

  public getSecondaryPoints(): number {
    const points = this.storage.getNumber(
      config.STORAGE_KEY_POINTS_HIGHSCORE_SECONDARY,
      0,
    );
    return points;
  }

  public saveSecondaryPoints(points: number): void {
    this.storage.setNumber(
      config.STORAGE_KEY_POINTS_HIGHSCORE_SECONDARY,
      points,
    );
    this.storage.save();
  }

  public getOverallMaxPoints(): number {
    const primaryPoints = this.getPrimaryPoints();
    const secondaryPoints = this.getSecondaryPoints();

    const points = [primaryPoints, secondaryPoints, config.DEFAULT_HIGHSCORE];

    const maxPoints = Math.max(...points);

    return maxPoints;
  }

  public async syncWithServer(): Promise<void> {
    try {
      const response = await apiFetch('/api/player', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          highscorePrimary: this.getPrimaryPoints(),
          highscoreSecondary: this.getSecondaryPoints(),
        }),
      });

      if (!response.ok) {
        return;
      }

      const body = await response.json();
      const player = body?.player;
      if (
        typeof player?.highscorePrimary !== 'number' ||
        typeof player?.highscoreSecondary !== 'number'
      ) {
        return;
      }

      this.storage.setNumber(
        config.STORAGE_KEY_POINTS_HIGHSCORE_PRIMARY,
        Math.max(this.getPrimaryPoints(), player.highscorePrimary),
      );
      this.storage.setNumber(
        config.STORAGE_KEY_POINTS_HIGHSCORE_SECONDARY,
        Math.max(this.getSecondaryPoints(), player.highscoreSecondary),
      );
      this.storage.save();
    } catch {
      // Highscore sync is best-effort; local play must remain available.
    }
  }
}
