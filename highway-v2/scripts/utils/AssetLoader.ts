import * as THREE from 'three';
import { loadingManager } from './LoadingManager';

interface Asset {
  type: 'texture' | 'video';
  path: string;
}

export class AssetLoader {
  private textureLoader: THREE.TextureLoader;
  private loadingManager: THREE.LoadingManager;
  private textureCache: Map<string, THREE.Texture>;
  private videoCache: Map<string, HTMLVideoElement>;
  private totalAssets: number = 0;
  private loadedAssets: number = 0;

  constructor() {
    this.textureLoader = new THREE.TextureLoader();
    this.loadingManager = new THREE.LoadingManager();
    this.textureCache = new Map();
    this.videoCache = new Map();
    this.setupLoadingManager();
  }

  private setupLoadingManager(): void {
    this.loadingManager.onStart = (url: string) => {
      console.log(`Started loading: ${url}`);
    };

    this.loadingManager.onProgress = (
      _url: string,
      itemsLoaded: number,
      itemsTotal: number,
    ) => {
      const progress = (itemsLoaded / itemsTotal) * 100;
      console.log(`Loading progress: ${progress.toFixed(2)}%`);
      this.updateProgress(itemsLoaded, itemsTotal);
    };

    this.loadingManager.onError = (url: string) => {
      console.error(`Error loading: ${url}`);
    };
  }

  private updateProgress(loaded: number, total: number): void {
    this.loadedAssets = loaded;
    this.totalAssets = total;
    const progress = total > 0 ? (loaded / total) * 100 : 0;
    loadingManager.updateProgress('assets', progress);
  }

  async loadTexture(path: string): Promise<THREE.Texture> {
    if (this.textureCache.has(path)) {
      return this.textureCache.get(path)!;
    }

    return new Promise<THREE.Texture>((resolve, reject) => {
      const fullPath = path.startsWith('http') ? path : `banners/${path}`;

      this.textureLoader.load(
        fullPath,
        (texture: THREE.Texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.generateMipmaps = true;
          this.textureCache.set(path, texture);
          this.loadedAssets++;
          this.updateProgress(this.loadedAssets, this.totalAssets);
          resolve(texture);
        },
        (progress: ProgressEvent) => {
          const percent = (progress.loaded / progress.total) * 100;
          console.log(`Loading ${path}: ${percent.toFixed(2)}%`);
        },
        (error: unknown) => {
          console.error(`Failed to load texture ${path}:`, error);
          reject(error);
        },
      );
    });
  }

  async loadVideo(path: string): Promise<HTMLVideoElement> {
    if (this.videoCache.has(path)) {
      return this.videoCache.get(path)!;
    }

    return new Promise<HTMLVideoElement>((resolve, reject) => {
      const video = document.createElement('video');
      const fullPath = path.startsWith('http') ? path : `banners/${path}`;

      video.src = fullPath;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';

      video.addEventListener('loadeddata', () => {
        this.videoCache.set(path, video);
        this.loadedAssets++;
        this.updateProgress(this.loadedAssets, this.totalAssets);
        resolve(video);
      });

      video.addEventListener('error', (error: Event) => {
        console.error(`Failed to load video ${path}:`, error);
        reject(error);
      });

      video.load();
    });
  }

  async preloadAssets(
    assetList: Asset[],
  ): Promise<(THREE.Texture | HTMLVideoElement)[]> {
    this.totalAssets = assetList.length;
    this.loadedAssets = 0;

    const promises: Promise<THREE.Texture | HTMLVideoElement>[] = [];
    for (const asset of assetList) {
      if (asset.type === 'texture') {
        promises.push(this.loadTexture(asset.path));
      } else if (asset.type === 'video') {
        promises.push(this.loadVideo(asset.path));
      }
    }

    return Promise.all(promises);
  }

  clearCache(): void {
    for (const texture of this.textureCache.values()) {
      texture.dispose();
    }
    this.textureCache.clear();

    for (const video of this.videoCache.values()) {
      video.pause();
      video.src = '';
    }
    this.videoCache.clear();
  }

  dispose(): void {
    this.clearCache();
  }
}
