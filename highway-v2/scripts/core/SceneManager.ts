import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SkyGradientShader } from '../shaders/SkyGradientShader';
import { applyCurvature } from '../shaders/WorldCurvature';

export class SceneManager {
  canvas: HTMLCanvasElement;
  scene: THREE.Scene;
  clock: THREE.Clock;
  renderer!: THREE.WebGLRenderer;
  camera!: THREE.PerspectiveCamera;
  controls!: OrbitControls;
  layers!: { [key: string]: number };
  ground!: THREE.Mesh | null;
  sky!: THREE.Mesh | null;
  sunLight!: THREE.DirectionalLight | null;
  private skyProgress = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();

    this.setupRenderer();
    this.setupCamera();
    this.setupLights();
    this.setupFog();
    this.setupLayers();
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: true,
      depth: false,
      logarithmicDepthBuffer: true,
      powerPreference: 'high-performance',
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
  }

  private responsiveFov(): number {
    const w = window.innerWidth;
    // 90° on desktop (>=1024), up to 110° on narrow mobile (<=480)
    const t = Math.max(0, Math.min(1, (1024 - w) / (1024 - 480)));
    return 90 + t * 20;
  }

  setupCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(this.responsiveFov(), aspect, 0.1, 1000);
    this.camera.position.set(0, 5, -10);
    this.camera.lookAt(0, 0, 0);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enabled = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0);
    ambientLight.layers.enableAll();
    this.scene.add(ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 0.1);
    this.sunLight.position.set(50, 100, 50);
    this.sunLight.castShadow = true;
    this.sunLight.layers.enableAll();

    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 500;
    this.sunLight.shadow.camera.left = -100;
    this.sunLight.shadow.camera.right = 100;
    this.sunLight.shadow.camera.top = 100;
    this.sunLight.shadow.camera.bottom = -100;

    this.scene.add(this.sunLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    hemiLight.layers.enableAll();
    this.scene.add(hemiLight);

    this.addGroundPlane();
  }

  setupFog() {
    this.scene.fog = new THREE.Fog(0x808080, 10, 200);
  }

  addGroundPlane() {
    const groundGeometry = new THREE.PlaneGeometry(400, 400, 100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      roughness: 1.0,
      metalness: 0.5,
      emissive: 0x000000,
      emissiveIntensity: 0.0,
    });
    applyCurvature(groundMaterial);
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.1;
    this.ground.receiveShadow = true;
    this.ground.layers.set(1);
    this.scene.add(this.ground);

    this.addGradientSky();
  }

  updateGroundPosition(x: number, z: number) {
    if (this.ground) {
      this.ground.position.x = x;
      this.ground.position.z = z;
      this.ground.position.y = -0.1;
    }
    if (this.sky) {
      this.sky.position.x = x;
      this.sky.position.z = z;
      this.sky.position.y = 0;
    }
  }

  updateSkyTime(time: number) {
    if (this.sky && this.sky.material instanceof THREE.ShaderMaterial) {
      this.sky.material.uniforms.time.value = time;
    }
  }

  updateSkyProgress(targetProgress: number) {
    if (this.sky && this.sky.material instanceof THREE.ShaderMaterial) {
      // Compute shortest-path delta on the circular 0–4 range so that
      // wrapping from part 3 back to part 0 moves forward through 4.0
      // instead of jumping backward. skyProgress is kept as a continuous
      // (unwrapped) value; the shader mods it back into 0–4.
      const current = ((this.skyProgress % 4) + 4) % 4;
      let delta = targetProgress - current;
      if (delta > 2) delta -= 4;
      if (delta < -2) delta += 4;
      this.skyProgress += delta;
      this.sky.material.uniforms.progress.value = this.skyProgress;
    }
  }

  updateSkyPrevEffect(idx: number) {
    if (this.sky && this.sky.material instanceof THREE.ShaderMaterial) {
      this.sky.material.uniforms.prevEffectIndex.value = idx;
    }
  }

  setCloudQuantization(value: number) {
    if (this.sky && this.sky.material instanceof THREE.ShaderMaterial) {
      this.sky.material.uniforms.cloudQuantization.value = value;
    }
  }

  addGradientSky() {
    const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: SkyGradientShader.uniforms,
      vertexShader: SkyGradientShader.vertexShader,
      fragmentShader: SkyGradientShader.fragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
    });

    skyMaterial.uniforms.topColor.value = new THREE.Color(0x111111);
    skyMaterial.uniforms.bottomColor.value = new THREE.Color(0x000000);
    skyMaterial.uniforms.offset.value = 40;
    skyMaterial.uniforms.exponent.value = 0.4;
    skyMaterial.uniforms.cloudQuantization.value = 50.0;

    this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
    this.sky.layers.set(1);
    this.scene.add(this.sky);
  }

  setupLayers() {
    this.layers = {
      DEFAULT: 0,
      ENVIRONMENT: 1,
      BANNERS: 2,
      UI: 3,
    };
    this.camera.layers.enableAll();
  }

  enableDebugControls(enabled = true) {
    this.controls.enabled = enabled;
  }

  handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.fov = this.responsiveFov();
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  dispose() {
    this.renderer.dispose();
    this.controls.dispose();
    this.scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m: THREE.Material) => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
    });
  }
}
