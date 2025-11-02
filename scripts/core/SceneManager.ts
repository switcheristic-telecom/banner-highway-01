import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SkyGradientShader } from '../shaders/SkyGradientShader';

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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();

    this.setupRenderer();
    this.setupCamera();
    this.setupLights();
    this.setupFog();

    // Setup layers for selective rendering
    this.setupLayers();
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: false,
      depth: false,
      logarithmicDepthBuffer: true,
      powerPreference: 'high-performance',
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
  }

  setupCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(
      90, // FOV
      aspect,
      0.1, // Near
      1000 // Far
    );

    // Initial camera position (will be overridden by navigation controller)
    this.camera.position.set(0, 5, -10);
    this.camera.lookAt(0, 0, 0);

    // Debug controls (disabled by default)
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enabled = false; // Will be controlled by NavigationController
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
  }

  setupLights() {
    // Ambient light for base illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0);
    ambientLight.layers.enableAll(); // Lights affect all layers
    this.scene.add(ambientLight);

    // Directional light (sun) - increased for visibility
    this.sunLight = new THREE.DirectionalLight(0xffffff, 0.3);
    this.sunLight.position.set(50, 100, 50);
    this.sunLight.castShadow = true;
    this.sunLight.layers.enableAll(); // Lights affect all layers

    // Shadow settings
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 500;
    this.sunLight.shadow.camera.left = -100;
    this.sunLight.shadow.camera.right = 100;
    this.sunLight.shadow.camera.top = 100;
    this.sunLight.shadow.camera.bottom = -100;

    this.scene.add(this.sunLight);

    // Hemisphere light for better illumination
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    hemiLight.layers.enableAll(); // Lights affect all layers
    this.scene.add(hemiLight);

    // Add a ground plane for reference
    this.addGroundPlane();
  }

  setupFog() {
    // Fog for depth - gray to match gradient
    this.scene.fog = new THREE.Fog(0x808080, 100, 500);
  }

  addGroundPlane() {
    // Add a circular ground plane that will follow the car
    const radius = 500; // Radius of the circle
    const segments = 12; // Number of segments for smooth circle
    const groundGeometry = new THREE.CircleGeometry(radius, segments);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000, // Black ground
      roughness: 1.0,
      metalness: 0.0,
      emissive: 0x000000, // No emission for ground
      emissiveIntensity: 0.0,
    });
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.1; // Slightly below the road
    this.ground.receiveShadow = true;
    this.ground.layers.set(1); // Environment layer for dithering
    this.scene.add(this.ground);

    // Add gradient sky
    this.addGradientSky();
  }

  updateGroundPosition(x: number, z: number) {
    // Update ground plane position to follow the car
    if (this.ground) {
      this.ground.position.x = x;
      this.ground.position.z = z;
      // Keep the y position fixed
      this.ground.position.y = -0.1;
    }

    // Update sky sphere position to follow the car
    if (this.sky) {
      this.sky.position.x = x;
      this.sky.position.z = z;
      // Keep the sky sphere centered vertically
      this.sky.position.y = 0;
    }
  }

  addGradientSky() {
    // Create a large sphere for the sky
    const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: SkyGradientShader.uniforms,
      vertexShader: SkyGradientShader.vertexShader,
      fragmentShader: SkyGradientShader.fragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
    });

    // Set gradient colors - white at top, gray at bottom
    skyMaterial.uniforms.topColor.value = new THREE.Color(0x000000);
    skyMaterial.uniforms.bottomColor.value = new THREE.Color(0x808080);
    skyMaterial.uniforms.exponent.value = 0.4;

    this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
    this.sky.layers.set(1); // Environment layer so it gets dithered
    this.scene.add(this.sky);
  }

  setupLayers() {
    // Layer 0: Default layer (everything)
    // Layer 1: Highway and environment (will get dithering effect)
    // Layer 2: Banners (will get bloom/no effect)
    // Layer 3: UI elements

    this.layers = {
      DEFAULT: 0,
      ENVIRONMENT: 1,
      BANNERS: 2,
      UI: 3,
    };

    // Enable all layers on camera by default
    this.camera.layers.enableAll();
  }

  enableDebugControls(enabled = true) {
    this.controls.enabled = enabled;
  }

  handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  dispose() {
    this.renderer.dispose();
    this.controls.dispose();

    // Dispose of all geometries and materials in the scene
    this.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        child.geometry.dispose();
      }
      if (child instanceof THREE.Mesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((material: THREE.Material) =>
            material.dispose()
          );
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
