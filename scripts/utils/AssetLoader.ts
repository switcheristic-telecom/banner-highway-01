import * as THREE from 'three';

interface Asset {
  type: 'texture' | 'video';
  path: string;
}

export class AssetLoader {
  private textureLoader: THREE.TextureLoader;
  private loadingManager: THREE.LoadingManager;
  private textureCache: Map<string, THREE.Texture>;
  private videoCache: Map<string, HTMLVideoElement>;

  constructor() {
    this.textureLoader = new THREE.TextureLoader();
    this.loadingManager = new THREE.LoadingManager();

    // Cache loaded assets
    this.textureCache = new Map<string, THREE.Texture>();
    this.videoCache = new Map<string, HTMLVideoElement>();

    // Setup loading manager callbacks
    this.setupLoadingManager();
  }

  private setupLoadingManager(): void {
    this.loadingManager.onStart = (
      url: string,
      _itemsLoaded: number,
      _itemsTotal: number
    ) => {
      console.log(`Started loading: ${url}`);
    };

    this.loadingManager.onProgress = (
      _url: string,
      itemsLoaded: number,
      itemsTotal: number
    ) => {
      const progress = (itemsLoaded / itemsTotal) * 100;
      console.log(`Loading progress: ${progress.toFixed(2)}%`);
    };

    this.loadingManager.onError = (_url: string) => {
      console.error(`Error loading: ${_url}`);
    };
  }

  async loadTexture(path: string): Promise<THREE.Texture> {
    // Check cache first
    if (this.textureCache.has(path)) {
      return this.textureCache.get(path)!;
    }

    return new Promise<THREE.Texture>((resolve, reject) => {
      // Construct full path - use relative path
      const fullPath = path.startsWith('http')
        ? path
        : `assets/banners/${path}`;

      this.textureLoader.load(
        fullPath,
        (texture: THREE.Texture) => {
          // Configure texture
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.generateMipmaps = true;

          // Cache the texture
          this.textureCache.set(path, texture);

          resolve(texture);
        },
        (progress: ProgressEvent) => {
          // Progress callback
          const percent = (progress.loaded / progress.total) * 100;
          console.log(`Loading ${path}: ${percent.toFixed(2)}%`);
        },
        (error: unknown) => {
          console.error(`Failed to load texture ${path}:`, error);
          reject(error);
        }
      );
    });
  }

  async loadVideo(path: string): Promise<HTMLVideoElement> {
    // Check cache first
    if (this.videoCache.has(path)) {
      return this.videoCache.get(path)!;
    }

    return new Promise<HTMLVideoElement>((resolve, reject) => {
      const video = document.createElement('video');
      const fullPath = path.startsWith('http')
        ? path
        : `assets/banners/${path}`;

      video.src = fullPath;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';

      video.addEventListener('loadeddata', () => {
        this.videoCache.set(path, video);
        resolve(video);
      });

      video.addEventListener('error', (error: Event) => {
        console.error(`Failed to load video ${path}:`, error);
        reject(error);
      });

      // Start loading
      video.load();
    });
  }

  async preloadAssets(
    assetList: Asset[]
  ): Promise<(THREE.Texture | HTMLVideoElement)[]> {
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
    // Dispose of all cached textures
    for (const texture of this.textureCache.values()) {
      texture.dispose();
    }
    this.textureCache.clear();

    // Clear video cache
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
