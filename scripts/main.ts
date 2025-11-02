import { HighwaySystem } from './highway/HighwaySystem';
import { BannerManager } from './banners/BannerManager';
import { AssetLoader } from './utils/AssetLoader';
import { SceneManager } from './core/SceneManager';
import { NavigationController } from './core/NavigationController';
import { RenderPipeline } from './core/RenderPipeline';

import { HIGHWAY_DATA } from '../constants/highway';
import { BANNER_INFOS } from '../constants/banner';

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
      // Initialize core systems
      this.sceneManager = new SceneManager(this.canvas);
      this.renderPipeline = new RenderPipeline(this.sceneManager);
      this.assetLoader = new AssetLoader();

      // Initialize highway system
      this.highwaySystem = new HighwaySystem(this.sceneManager.scene);
      await this.highwaySystem.loadHighwayData(HIGHWAY_DATA);

      // Initialize banner manager
      this.bannerManager = new BannerManager(
        this.sceneManager.scene,
        this.assetLoader
      );
      await this.bannerManager.loadBanners(BANNER_INFOS);

      // Initialize navigation
      this.navigationController = new NavigationController(
        this.highwaySystem,
        this.sceneManager.camera
      );

      // Hide loading screen
      this.hideLoadingScreen();

      // Start render loop
      this.isInitialized = true;
      this.animate();

      // Setup event listeners
      this.setupEventListeners();
    } catch (error: any) {
      console.error('Failed to initialize Banner Highway:', error);
      this.showError(error.message);
    }
  }

  setupEventListeners() {
    // Window resize
    window.addEventListener('resize', () => this.handleResize());

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      // Toggle controls panel (C key)
      if (e.key === 'c' || e.key === 'C') {
        const controlsPanel = document.getElementById('controls-panel');
        if (controlsPanel) {
          controlsPanel.classList.toggle('hidden');
        }
      }

      // Toggle edge lines (E key)
      if (e.key === 'e' || e.key === 'E') {
        const newState = this.highwaySystem.toggleEdgeLines(true);
        console.log(`Edge lines: ${newState ? 'ON' : 'OFF'}`);
      }

      // Toggle blocks/guardrails (B key)
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

    // Update systems
    const deltaTime = this.sceneManager.clock.getDelta();
    const elapsedTime = this.sceneManager.clock.getElapsedTime();

    // Update navigation
    this.navigationController.update(deltaTime);

    // Update highway (for any animations)
    this.highwaySystem.update(deltaTime);

    // Update banners (for video textures and visibility)
    const currentPosition = this.navigationController.getCurrentPosition();
    this.bannerManager.update(deltaTime, currentPosition);

    // Render
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
    // if (this.animationId) {
    //   cancelAnimationFrame(this.animationId);
    // }
    // Cleanup all systems
    // this.navigationController?.dispose();
    // this.bannerManager?.dispose();
    // this.highwaySystem?.dispose();
    // this.renderPipeline?.dispose();
    // this.sceneManager?.dispose();
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new BannerHighwayApp();
  (window as any).app = app; // Expose globally for Billboard access
  app.init();

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    app.dispose();
  });
});
