import { Sprite } from '../graphics';

import { Rect } from '../Rect';

import { ImageLoader } from './ImageLoader';

interface SpriteManifestItem {
  file: string;
  rect: number[];
  // How many times larger the source art is than its logical (gameplay) size.
  // e.g. a tank authored at 4x for HD detail uses scale: 4 and still draws at
  // its ~52px footprint. Defaults to 1 (source size == draw size).
  scale?: number;
}

interface SpriteManifest {
  [id: string]: SpriteManifestItem;
}

interface SpriteLoaderOptions {
  scale?: number;
}

const DEFAULT_OPTIONS = {
  scale: 1,
};

export class SpriteLoader {
  private readonly imageLoader: ImageLoader;
  private readonly manifest: SpriteManifest;
  private readonly options: SpriteLoaderOptions;

  constructor(
    imageLoader: ImageLoader,
    manifest: SpriteManifest,
    options: SpriteLoaderOptions = {},
  ) {
    this.imageLoader = imageLoader;
    this.manifest = manifest;
    this.options = Object.assign({}, DEFAULT_OPTIONS, options);
  }

  public load(id: string, argDestinationRect?: Rect): Sprite {
    const item = this.manifest[id];
    if (item === undefined) {
      throw new Error(`Invalid sprite id = "${id}"`);
    }

    const { file: filePath, rect: sourceRectValues, scale: itemScale = 1 } = item;
    const image = this.imageLoader.load(filePath);
    const sourceRect = new Rect(...sourceRectValues);

    // Source art may be authored larger than its logical size (HD detail);
    // itemScale divides it back down so the drawn footprint is unchanged.
    const drawScale = this.options.scale / itemScale;
    const defaultDestinationRect = new Rect(
      0,
      0,
      sourceRect.width * drawScale,
      sourceRect.height * drawScale,
    );

    const destinationRect = argDestinationRect ?? defaultDestinationRect;

    const sprite = new Sprite(image, sourceRect, destinationRect);

    return sprite;
  }

  public async loadAsync(
    id: string,
    destinationRect = new Rect(),
  ): Promise<Sprite> {
    return new Promise((resolve) => {
      const sprite = this.load(id, destinationRect);
      if (sprite.image.isLoaded()) {
        resolve(sprite);
      } else {
        sprite.image.loaded.addListenerOnce(() => {
          resolve(sprite);
        });
      }
    });
  }

  public loadList(ids: string[]): Sprite[] {
    const sprites = ids.map((id) => {
      const sprite = this.load(id);

      return sprite;
    });

    return sprites;
  }

  // Loads a numbered animation sequence "<prefix>.1", "<prefix>.2", ... up to
  // however many consecutive frames exist in the manifest. This makes frame
  // count data-driven by the art: dropping in "<prefix>.3" extends the
  // animation with no code change. Returns frames in order.
  public loadSequence(prefix: string): Sprite[] {
    const sprites: Sprite[] = [];

    for (let index = 1; ; index += 1) {
      const id = `${prefix}.${index}`;
      if (this.manifest[id] === undefined) {
        break;
      }
      sprites.push(this.load(id));
    }

    return sprites;
  }

  public preloadAll(): void {
    Object.keys(this.manifest).forEach((id) => {
      this.load(id);
    });
  }

  public async preloadAllAsync(): Promise<void> {
    await Promise.all(
      Object.keys(this.manifest).map((id) => {
        return this.loadAsync(id);
      }),
    );
  }
}
