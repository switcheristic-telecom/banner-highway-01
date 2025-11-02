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
  PixelationEffect,
  ScanlineEffect,
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
    const lambdaPassC = new LambdaPass(() => {
      this.camera.layers.set(3);
    });

    const clearPassA = new ClearPass();
    const clearPassB = new ClearPass();
    const clearPassC = new ClearPass();
    clearPassA.overrideClearAlpha = 0.0;
    clearPassB.overrideClearAlpha = 0.0;
    clearPassC.overrideClearAlpha = 0.0;

    const renderPass = new RenderPass(this.scene, this.camera);
    renderPass.clear = false;

    const copyPass = new CopyPass();
    copyPass.texture.format = THREE.RGBAFormat;

    const copyCPass = new CopyPass();
    copyCPass.texture.format = THREE.RGBAFormat;

    const passAEffect = new ScanlineEffect({
      density: 1,
    });

    const pixelEffect = new PixelationEffect(4);

    const envBloomEffect = new BloomEffect({
      blendFunction: BlendFunction.ADD,
      kernelSize: KernelSize.LARGE,
      luminanceThreshold: 0.0,
      luminanceSmoothing: 0.1,
      intensity: 3,
      radius: 0.8,
      levels: 10,
    });
    const envBloomEffectPass = new EffectPass(this.camera, envBloomEffect);
    const textureEffectC = new TextureEffect({
      blendFunction: BlendFunction.ADD,
      texture: copyCPass.texture,
    });
    const blendCPass = new EffectPass(this.camera, textureEffectC);

    const bloomEffect = new BloomEffect({
      blendFunction: BlendFunction.ADD,
      kernelSize: KernelSize.LARGE,
      luminanceThreshold: 0.0,
      luminanceSmoothing: 0.1,
      intensity: 3,
      radius: 0.8,
      levels: 10,
    });

    const textureEffect = new TextureEffect({
      blendFunction: BlendFunction.ADD,
      texture: copyPass.texture,
    });

    const passAEffectPass = new EffectPass(this.camera, passAEffect);
    const pixelEffectPass = new EffectPass(this.camera, pixelEffect);
    const bloomEffectPass = new EffectPass(this.camera, bloomEffect);
    const blendPass = new EffectPass(this.camera, textureEffect);

    this.composer.addPass(clearPassB);
    this.composer.addPass(lambdaPassB);
    this.composer.addPass(renderPass);
    this.composer.addPass(bloomEffectPass);
    this.composer.addPass(copyPass);

    this.composer.addPass(clearPassC);
    this.composer.addPass(lambdaPassC);
    this.composer.addPass(renderPass);
    this.composer.addPass(envBloomEffectPass);
    this.composer.addPass(copyCPass);

    this.composer.addPass(clearPassA);
    this.composer.addPass(lambdaPassA);
    this.composer.addPass(renderPass);
    this.composer.addPass(blendCPass);
    this.composer.addPass(pixelEffectPass);
    this.composer.addPass(passAEffectPass);

    this.composer.addPass(blendPass);
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
    this.renderer.setSize(width, height);
  }

  dispose() {
    this.composer.dispose();
  }
}
