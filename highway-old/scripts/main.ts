import { HighwaySystem } from './highway/HighwaySystem';
import { BannerManager } from './banners/BannerManager';
import { AssetLoader } from './utils/AssetLoader';
import { SceneManager } from './core/SceneManager';
import { NavigationController } from './core/NavigationController';
import { RenderPipeline } from './core/RenderPipeline';
import { loadingManager } from './utils/LoadingManager';
import { loadSceneData } from './data/DataProvider';

class BannerHighwayApp {
  canvas: HTMLCanvasElement;
  isInitialized: boolean;
  animationId: number | null;
  sceneManager!: SceneManager;
  assetLoader!: AssetLoader;
  highwaySystem!: HighwaySystem;
  bannerManager!: BannerManager;
  navigationController!: NavigationController;
  renderPipeline!: RenderPipeline;

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

      loadingManager.setStatus('Loading highway system...');
      this.highwaySystem = new HighwaySystem(this.sceneManager.scene);
      await this.highwaySystem.loadHighwayData(sceneData.highway);
      loadingManager.updateProgress('highway', 100);

      loadingManager.setStatus('Loading banners...');
      this.bannerManager = new BannerManager(
        this.sceneManager.scene,
        this.assetLoader,
        this.highwaySystem
      );
      await this.bannerManager.loadBanners(sceneData.banners);
      loadingManager.updateProgress('banners', 100);

      loadingManager.setStatus('Setting up navigation...');
      this.navigationController = new NavigationController(
        this.highwaySystem,
        this.sceneManager.camera
      );
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
        if (controlsPanel) {
          controlsPanel.classList.toggle('hidden');
        }
      }

      if (e.key === 'e' || e.key === 'E') {
        const newState = this.highwaySystem.toggleEdgeLines(true);
        console.log(`Edge lines: ${newState ? 'ON' : 'OFF'}`);
      }

      if (e.key === 'b' || e.key === 'B') {
        const newState = this.highwaySystem.toggleBlocks(true);
        console.log(`Blocks/Guardrails: ${newState ? 'ON' : 'OFF'}`);
      }
    });
  }

  handleResize() {
    if (this.sceneManager) {
      this.sceneManager.handleResize();
    }
    if (this.renderPipeline) {
      this.renderPipeline.handleResize();
    }
  }

  animate() {
    if (!this.isInitialized) return;

    this.animationId = requestAnimationFrame(() => this.animate());

    const deltaTime = this.sceneManager.clock.getDelta();
    const elapsedTime = this.sceneManager.clock.getElapsedTime();

    this.sceneManager.updateSkyTime(elapsedTime);
    this.navigationController.update(deltaTime);
    this.highwaySystem.update(deltaTime);

    const currentPosition = this.navigationController.getCurrentPosition();
    this.bannerManager.update(deltaTime, currentPosition);

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
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.bannerManager?.dispose();
    this.highwaySystem?.dispose();
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
