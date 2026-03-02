import * as THREE from 'three';
import { RoadSystem } from './road/RoadSystem';
import { BannerManager } from './banners/BannerManager';
import type { Billboard } from './banners/Billboard';
import { AssetLoader } from './utils/AssetLoader';
import { SceneManager } from './core/SceneManager';
import { NavigationController } from './core/NavigationController';
import { RenderPipeline } from './core/RenderPipeline';
import { loadingManager } from './utils/LoadingManager';
import { loadSceneData } from './data/DataProvider';
import type { HighwayPart } from '../shared/types';
import { MusicManager } from './audio/MusicManager';
import {
  reverbReady,
  applySettings,
  ensureAudioStarted,
} from './audio/AudioEngine';

class BannerHighwayApp {
  canvas: HTMLCanvasElement;
  isInitialized: boolean;
  animationId: number | null;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  sceneManager!: SceneManager;
  assetLoader!: AssetLoader;
  roadSystem!: RoadSystem;
  bannerManager!: BannerManager;
  navigationController!: NavigationController;
  renderPipeline!: RenderPipeline;
  musicManager!: MusicManager;
  skyPartsByRoad: Map<string, HighwayPart[]> = new Map();
  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();
  private raycastMeshes: THREE.Object3D[] = [];
  private meshToBillboard = new Map<THREE.Object3D, Billboard>();

  constructor() {
    this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
    this.isInitialized = false;
    this.animationId = null;
  }

  async init() {
    try {
      loadingManager.setStatus('Initializing core systems...');
      loadingManager.updateProgress('init', 10);

      this.sceneManager = new SceneManager(this.canvas);
      this.renderPipeline = new RenderPipeline(this.sceneManager);
      this.assetLoader = new AssetLoader();
      loadingManager.updateProgress('init', 20);

      loadingManager.setStatus('Loading scene data...');
      const sceneData = await loadSceneData();
      loadingManager.updateProgress('init', 40);

      loadingManager.setStatus('Loading road system...');
      this.roadSystem = new RoadSystem(this.sceneManager.scene);
      this.roadSystem.loadNetwork(sceneData.roadNetwork);
      loadingManager.updateProgress('road', 100);

      loadingManager.setStatus('Loading banners...');
      this.bannerManager = new BannerManager(
        this.sceneManager.scene,
        this.assetLoader,
        this.roadSystem,
      );
      await this.bannerManager.loadBanners(sceneData.banners);
      loadingManager.updateProgress('banners', 100);

      loadingManager.setStatus('Setting up navigation...');
      this.navigationController = new NavigationController(
        this.roadSystem,
        this.sceneManager.camera,
      );

      // Start at a random part's starting point
      if (sceneData.parts.length > 0) {
        const randomPart =
          sceneData.parts[Math.floor(Math.random() * sceneData.parts.length)];
        const offsetT = 0.014; // small offset to avoid potential edge cases at t=0
        const startT = (randomPart.startT + offsetT) % 1.0;
        this.navigationController.setPosition(randomPart.roadId, startT);
      }

      loadingManager.setStatus('Initializing music...');
      this.musicManager = new MusicManager(
        sceneData.parts,
        sceneData.songs,
        sceneData.partSongs,
        this.roadSystem,
      );
      if (sceneData.audioSettings) {
        applySettings(sceneData.audioSettings);
      }
      reverbReady.then(() => console.log('Reverb IR ready'));

      // Build sorted parts per road for sky effect lookup
      for (const part of sceneData.parts) {
        let arr = this.skyPartsByRoad.get(part.roadId);
        if (!arr) {
          arr = [];
          this.skyPartsByRoad.set(part.roadId, arr);
        }
        arr.push(part);
      }
      for (const arr of this.skyPartsByRoad.values()) {
        arr.sort((a, b) => a.startT - b.startT);
      }

      loadingManager.updateProgress('init', 100);

      loadingManager.complete();

      this.isInitialized = true;
      this.animate();
      this.setupEventListeners();

      // Show "Start" button — user gesture needed for Web Audio
      this.showStartButton();
    } catch (error: any) {
      console.error('Failed to initialize Banner Highway:', error);
      this.showError(error.message);
    }
  }

  setupEventListeners() {
    const debouncedResize = () => {
      if (this.resizeTimer) clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => this.handleResize(), 100);
    };
    window.addEventListener('resize', debouncedResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', debouncedResize);
    }

    // About modal
    const aboutBtn = document.getElementById('about-btn');
    const aboutModal = document.getElementById('about-modal');
    const openAbout = () => {
      aboutModal?.classList.add('visible');
      this.navigationController.inputEnabled = false;
    };
    const closeAbout = () => {
      aboutModal?.classList.remove('visible');
      this.navigationController.inputEnabled = true;
    };
    if (aboutBtn && aboutModal) {
      aboutBtn.addEventListener('click', openAbout);
      aboutModal.querySelector('.about-backdrop')?.addEventListener('click', closeAbout);
      aboutModal.querySelector('.about-close')?.addEventListener('click', closeAbout);
    }

    // Music toggle
    const musicBtn = document.getElementById('music-btn');
    if (musicBtn) {
      musicBtn.addEventListener('click', async () => {
        if (this.musicManager.isEnabled()) {
          this.musicManager.disable();
          musicBtn.classList.remove('music-on');
        } else {
          await ensureAudioStarted();
          this.musicManager.enable();
          musicBtn.classList.add('music-on');
        }
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (aboutModal?.classList.contains('visible')) closeAbout();
      }
      if (e.key === 'c' || e.key === 'C') {
        const controlsPanel = document.getElementById('controls-panel');
        if (controlsPanel) controlsPanel.classList.toggle('hidden');
      }
      if (e.key === 'e' || e.key === 'E') {
        this.roadSystem.toggleEdgeLines();
      }
      if (e.key === 'b' || e.key === 'B') {
        this.roadSystem.toggleBlocks();
      }
    });

    // Billboard click → open URL in new tab
    this.canvas.addEventListener('click', (e) => {
      const url = this.raycastBillboardUrl(e);
      if (url) window.open(url, '_blank', 'noopener');
    });

    // Billboard hover → show pointer cursor
    this.canvas.addEventListener('pointermove', (e) => {
      const url = this.raycastBillboardUrl(e);
      this.canvas.style.cursor = url ? 'help' : '';
    });
  }

  private raycastBillboardUrl(e: MouseEvent): string | null {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointerNdc, this.sceneManager.camera);
    this.raycaster.layers.set(2); // BANNERS layer only

    // Reuse arrays — only include visible billboards that have a URL
    this.raycastMeshes.length = 0;
    this.meshToBillboard.clear();
    for (const billboard of this.bannerManager.billboards.values()) {
      if (billboard.bannerMesh && billboard.group.visible && billboard.info.url) {
        this.raycastMeshes.push(billboard.bannerMesh);
        this.meshToBillboard.set(billboard.bannerMesh, billboard);
      }
    }
    if (this.raycastMeshes.length === 0) return null;

    const hits = this.raycaster.intersectObjects(this.raycastMeshes);
    if (hits.length === 0) return null;

    const billboard = this.meshToBillboard.get(hits[0].object);
    if (!billboard) return null;

    const url = billboard.info.url!;
    try {
      const protocol = new URL(url).protocol;
      if (protocol === 'http:' || protocol === 'https:') return url;
    } catch { /* malformed URL */ }
    return null;
  }

  handleResize() {
    this.sceneManager?.handleResize();
    this.renderPipeline?.handleResize();
  }

  animate() {
    if (!this.isInitialized) return;

    this.animationId = requestAnimationFrame(() => this.animate());

    const deltaTime = this.sceneManager.clock.getDelta();
    const elapsedTime = this.sceneManager.clock.getElapsedTime();

    this.sceneManager.updateSkyTime(elapsedTime);
    this.navigationController.update(deltaTime);

    const currentPosition = this.navigationController.getCurrentPosition();
    this.updateSkyFromParts(currentPosition);
    this.bannerManager.update(deltaTime, currentPosition);
    this.musicManager.update(currentPosition);
    this.musicManager.tick(deltaTime);

    this.renderPipeline.render();
  }

  updateSkyFromParts(pos: { roadId: string; t: number }) {
    const parts = this.skyPartsByRoad.get(pos.roadId);
    if (!parts || parts.length === 0) {
      // Fallback: linear mapping across 4 effects
      this.sceneManager.updateSkyProgress(pos.t * 4.0);
      this.sceneManager.updateSkyPrevEffect(Math.floor(pos.t * 4.0 + 3) % 4);
      return;
    }

    // Find current part (last part with startT <= t)
    let currentIdx = -1;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (pos.t >= parts[i].startT) {
        currentIdx = i;
        break;
      }
    }
    // If before first part on cyclic road, wrap to last
    if (currentIdx < 0) currentIdx = parts.length - 1;

    const current = parts[currentIdx];
    const prevIdx = (currentIdx - 1 + parts.length) % parts.length;
    const prev = parts[prevIdx];

    // Compute localT: how far through this part (0→1)
    const nextStartT =
      currentIdx < parts.length - 1 ? parts[currentIdx + 1].startT : 1.0; // or wraps to first part on cyclic
    const partLength = nextStartT - current.startT;
    const localT = partLength > 0 ? (pos.t - current.startT) / partLength : 0;

    this.sceneManager.updateSkyProgress(
      current.skyEffect + Math.max(0, Math.min(1, localT)),
    );
    this.sceneManager.updateSkyPrevEffect(prev.skyEffect);
  }

  showStartButton() {
    const btn = document.getElementById('start-btn');
    const status = document.getElementById('loading-status');
    const progress = document.querySelector(
      '.progress-container',
    ) as HTMLElement;
    const loadingScreen = document.getElementById('loading-screen');
    if (btn) {
      btn.style.display = '';
      if (status) status.style.display = 'none';
      if (progress) progress.style.display = 'none';
      if (loadingScreen) loadingScreen.classList.add('start-ready');
      btn.addEventListener(
        'click',
        async () => {
          await this.enterImmersive();
          await ensureAudioStarted();
          this.musicManager.enable();
          this.hideLoadingScreen();
          this.navigationController.inputEnabled = true;
          this.setupOrientationGate();
          // Reflect that music is now on
          const musicBtn = document.getElementById('music-btn');
          if (musicBtn) musicBtn.classList.add('music-on');
        },
        { once: true },
      );
    }
  }

  private isTouchDevice() {
    return window.matchMedia('(pointer: coarse)').matches;
  }

  async enterImmersive() {
    if (!this.isTouchDevice()) return;

    try {
      await document.documentElement.requestFullscreen();
    } catch (_) {
      /* iOS / unsupported — expected */
    }

    try {
      await screen.orientation.lock('landscape');
    } catch (_) {
      /* iOS / non-fullscreen context — expected */
    }
  }

  private setupOrientationGate() {
    const overlay = document.getElementById('rotate-overlay');
    if (!overlay) return;

    if (!this.isTouchDevice()) return;

    const mql = window.matchMedia('(orientation: portrait)');

    const update = (portrait: boolean) => {
      overlay.classList.toggle('visible', portrait);
      this.navigationController.inputEnabled = !portrait;
    };

    update(mql.matches);
    mql.addEventListener('change', (e) => update(e.matches));
  }

  hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (!loadingScreen) return;
    loadingScreen.classList.add('hidden');
    setTimeout(() => (loadingScreen.style.display = 'none'), 500);
  }

  showError(message: string) {
    const loadingText = document.querySelector('.loading-text') as HTMLElement;
    if (!loadingText) return;
    loadingText.textContent = `Error: ${message}`;
    loadingText.style.color = '#ff0000';
  }

  dispose() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.musicManager?.dispose();
    this.bannerManager?.dispose();
    this.roadSystem?.dispose();
    this.renderPipeline?.dispose();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new BannerHighwayApp();
  (window as any).app = app;
  app.init();

  window.addEventListener('beforeunload', () => {
    app.dispose();
  });
});
