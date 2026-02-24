import { RoadSystem } from './road/RoadSystem';
import { BannerManager } from './banners/BannerManager';
import { AssetLoader } from './utils/AssetLoader';
import { SceneManager } from './core/SceneManager';
import { NavigationController } from './core/NavigationController';
import { RenderPipeline } from './core/RenderPipeline';
import { loadingManager } from './utils/LoadingManager';
import { loadSceneData } from './data/DataProvider';
import { MusicManager } from './audio/MusicManager';
import { createMusicPanel, togglePanel as toggleMusicPanel } from './audio/MusicControls';
import { reverbReady } from './audio/AudioEngine';

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

      loadingManager.setStatus('Initializing music...');
      this.musicManager = new MusicManager(
        sceneData.parts,
        sceneData.songs,
        sceneData.partSongs,
        this.roadSystem,
      );
      createMusicPanel();
      reverbReady.then(() => console.log('Reverb IR ready'));

      loadingManager.updateProgress('init', 100);

      loadingManager.complete();
      setTimeout(() => this.hideLoadingScreen(), 500);

      this.isInitialized = true;
      this.animate();
      this.setupEventListeners();
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
      if (e.key === 'm' || e.key === 'M') {
        toggleMusicPanel();
      }
    });

    const musicToggle = document.getElementById('music-toggle');
    if (musicToggle) {
      musicToggle.addEventListener('click', () => toggleMusicPanel());
    }
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
    this.bannerManager.update(deltaTime, currentPosition);
    this.musicManager.update(currentPosition);
    this.musicManager.tick(deltaTime);

    this.renderPipeline.render();
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
