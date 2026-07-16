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

    const {
      file: filePath,
      rect: sourceRectValues,
      scale: itemScale = 1,
    } = item;
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

  public has(id: string): boolean {
    return this.manifest[id] !== undefined;
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
    await this.preloadAsync(Object.keys(this.manifest));
  }

  public async preloadAsync(ids: string[]): Promise<void> {
    const filePaths = this.getUniqueFilePaths(ids);
    await Promise.all(
      filePaths.map((filePath) => this.imageLoader.loadAsync(filePath)),
    );
  }

  public async preloadRequiredByPrefixAsync(prefix: string): Promise<void> {
    const ids = Object.keys(this.manifest).filter((id) =>
      id.startsWith(prefix),
    );
    if (ids.length === 0) {
      throw new Error(`No sprites found with prefix = "${prefix}"`);
    }

    const filePaths = this.getUniqueFilePaths(ids);

    while (true) {
      const images = await Promise.all(
        filePaths.map((filePath) => this.imageLoader.retryAsync(filePath)),
      );
      if (images.every((image) => image.isLoaded())) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  public async preloadAllInBatchesAsync(batchSize = 4): Promise<void> {
    const filePaths = this.getUniqueFilePaths(Object.keys(this.manifest));
    const safeBatchSize = Math.max(1, Math.floor(batchSize));

    for (let index = 0; index < filePaths.length; index += safeBatchSize) {
      const batch = filePaths.slice(index, index + safeBatchSize);
      await Promise.all(
        batch.map((filePath) => this.imageLoader.loadAsync(filePath)),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  private getUniqueFilePaths(ids: string[]): string[] {
    const filePaths = new Set<string>();

    ids.forEach((id) => {
      const item = this.manifest[id];
      if (item === undefined) {
        throw new Error(`Invalid sprite id = "${id}"`);
      }
      filePaths.add(item.file);
    });

    return Array.from(filePaths);
  }
}
