import { SceneParams } from '../../../core';
import { SavedReplay } from '../../../replay';

export interface LevelLoadLocationParams extends SceneParams {
  replay?: SavedReplay;
}
