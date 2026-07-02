import { SceneParams } from '../../../core';
import { MapConfig } from '../../../map';
import { SavedReplay } from '../../../replay';

export interface LevelPlayLocationParams extends SceneParams {
  mapConfig: MapConfig;
  // When present, the level plays back this recorded match instead of live
  // input (dev-only entry point: the main menu's REPLAY item).
  replay?: SavedReplay;
}
