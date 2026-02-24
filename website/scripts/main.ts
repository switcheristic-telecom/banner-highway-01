import { RoadSystem } from './road/RoadSystem';
import { BannerManager } from './banners/BannerManager';
import { AssetLoader } from './utils/AssetLoader';
import { SceneManager } from './core/SceneManager';
import { NavigationController } from './core/NavigationController';
import { RenderPipeline } from './core/RenderPipeline';
import { loadingManager } from './utils/LoadingManager';
import { loadSceneData } from './data/DataProvider';
import type { HighwayPart } from '../shared/types';
import { MusicManager } from './audio/MusicManager';
import { reverbReady, applySettings, ensureAudioStarted } from './audio/AudioEngine';

class BannerHighwayApp {
  canvas: HTMLCanvasElement;
  isInitialized: boolean;
  animationId: number | null;
  sceneManager!: SceneManager;
  assetLoader!: AssetLoader;
  roadSystem!: RoadSystem;
  bannerManager!: BannerManager;
  navigationController!: NavigationController;
  renderPipeline!: RenderPipeline;
  musicManager!: MusicManager;
  skyPartsByRoad: Map<string, HighwayPart[]> = new Map();

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
        const randomPart = sceneData.parts[Math.floor(Math.random() * sceneData.parts.length)];
        this.navigationController.setPosition(randomPart.roadId, randomPart.startT);
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
        if (!arr) { arr = []; this.skyPartsByRoad.set(part.roadId, arr); }
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

      // Show "Enter Experience" button — user gesture needed for Web Audio
      this.showEnterButton();
    } catch (error: any) {
      console.error('Failed to initialize Banner Highway:', error);
      this.showError(error.message);
    }
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.handleResize());

    window.addEventListener('keydown', (e) => {
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
    const nextStartT = currentIdx < parts.length - 1
      ? parts[currentIdx + 1].startT
      : 1.0; // or wraps to first part on cyclic
    const partLength = nextStartT - current.startT;
    const localT = partLength > 0 ? (pos.t - current.startT) / partLength : 0;

    this.sceneManager.updateSkyProgress(current.skyEffect + Math.max(0, Math.min(1, localT)));
    this.sceneManager.updateSkyPrevEffect(prev.skyEffect);
  }

  showEnterButton() {
    const btn = document.getElementById('enter-btn');
    const status = document.getElementById('loading-status');
    const progress = document.querySelector('.progress-container') as HTMLElement;
    const loadingScreen = document.getElementById('loading-screen');
    if (btn) {
      btn.style.display = '';
      if (status) status.style.display = 'none';
      if (progress) progress.style.display = 'none';
      if (loadingScreen) loadingScreen.classList.add('enter-ready');
      btn.addEventListener('click', async () => {
        await ensureAudioStarted();
        this.hideLoadingScreen();
      }, { once: true });
    }
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
