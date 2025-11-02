import * as THREE from 'three';
import {
  EffectComposer,
  RenderPass,
  LambdaPass,
  ClearPass,
  EffectPass,
  BloomEffect,
  KernelSize,
  CopyPass,
  BlendFunction,
  NoiseEffect,
  TextureEffect,
  DotScreenEffect,
} from 'postprocessing';

import { SceneManager } from './SceneManager';

export class RenderPipeline {
  sceneManager: SceneManager;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  debugMode: number;

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
    this.renderer = sceneManager.renderer;
    this.scene = sceneManager.scene;
    this.camera = sceneManager.camera;

    // Set up for proper color management
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = false;

    // Enable layers on camera to see all layers
    this.camera.layers.enableAll();

    this.debugMode = 1;

    this.composer = new EffectComposer(this.renderer, {
      frameBufferType: THREE.HalfFloatType,
    });

    const lambdaPassA = new LambdaPass(() => {
      this.camera.layers.set(1);
    });

    const lambdaPassB = new LambdaPass(() => {
      this.camera.layers.set(2);
    });

    const clearPassA = new ClearPass();
    const clearPassB = new ClearPass();
    clearPassA.overrideClearAlpha = 0.0;
    clearPassB.overrideClearAlpha = 0.0;

    const renderPass = new RenderPass(this.scene, this.camera);
    renderPass.clear = false;

    const copyBannerPass = new CopyPass();
    copyBannerPass.texture.format = THREE.RGBAFormat;

    const copyProcessedBannerPass = new CopyPass();
    copyProcessedBannerPass.texture.format = THREE.RGBAFormat;

    const passAEffect = new DotScreenEffect({
      blendFunction: BlendFunction.ADD,
      angle: 45,
      scale: 1,
    });

    const bloomEffect = new BloomEffect({
      blendFunction: BlendFunction.ADD,
      kernelSize: KernelSize.LARGE,
      luminanceThreshold: 0.0,
      luminanceSmoothing: 0.1,
      intensity: 2,
      radius: 0.8,
      levels: 10,
    });

    const bannerTextureEffect = new TextureEffect({
      blendFunction: BlendFunction.NORMAL,
      texture: copyBannerPass.texture,
    });

    const processedBannerTextureEffect = new TextureEffect({
      blendFunction: BlendFunction.SCREEN,
      texture: copyProcessedBannerPass.texture,
    });

    const passAEffectPass = new EffectPass(this.camera, passAEffect);
    const bloomEffectPass = new EffectPass(this.camera, bloomEffect);
    const blendBannerPass = new EffectPass(this.camera, bannerTextureEffect);
    const blendProcessedBannerPass = new EffectPass(
      this.camera,
      processedBannerTextureEffect
    );

    this.composer.addPass(clearPassB);
    this.composer.addPass(lambdaPassB);
    this.composer.addPass(renderPass);
    this.composer.addPass(copyBannerPass);
    this.composer.addPass(bloomEffectPass);
    this.composer.addPass(copyProcessedBannerPass);

    this.composer.addPass(clearPassA);
    this.composer.addPass(lambdaPassA);
    this.composer.addPass(renderPass);
    this.composer.addPass(passAEffectPass);

    this.composer.addPass(blendBannerPass);
    // this.composer.addPass(blendProcessedBannerPass);
  }

  render() {
    this.composer.getRenderer().info.reset();
    this.composer.render();
  }

  handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Resize render target
    this.composer.setSize(width, height);
  }

  dispose() {
    this.composer.dispose();
  }
}
