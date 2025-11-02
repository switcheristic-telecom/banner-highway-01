import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

import { HighwaySystem } from '../highway/HighwaySystem';
import { SceneManager } from './SceneManager';

const CAR_X_OFFSET = -1.4;
export class NavigationController {
  highwaySystem: HighwaySystem;
  camera: THREE.PerspectiveCamera;

  currentBranchId: string;
  currentT: number;
  speed: number;
  targetSpeed: number;
  maxSpeed: number;
  acceleration: number;
  deceleration: number;
  linearScrollMode: boolean;
  linearScrollSensitivity: number;

  cameraHeight: number;
  cameraDistance: number;
  cameraLookAhead: number;
  scrollAccumulator: number;
  scrollSensitivity: number;
  isScrolling: boolean;
  scrollTimeout: NodeJS.Timeout | null;
  car: THREE.Group;
  keys: { forward: boolean; backward: boolean; left: boolean; right: boolean };

  constructor(highwaySystem: HighwaySystem, camera: THREE.PerspectiveCamera) {
    this.highwaySystem = highwaySystem;
    this.camera = camera;

    // Navigation state
    this.currentBranchId = 'main';
    this.currentT = 0.0; // Position along the spline (0 to 1)
    this.speed = 0;
    this.targetSpeed = 0;
    this.maxSpeed = 0.1;
    this.acceleration = 0.1;
    this.deceleration = 0.1;

    // Linear scroll mode
    this.linearScrollMode = true; // Enable linear scrolling like a webpage
    this.linearScrollSensitivity = 0.0002; // Direct position change per scroll unit

    // Camera settings
    this.cameraHeight = 10;
    this.cameraDistance = 10;
    this.cameraLookAhead = 0.05;

    // Input state
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
    };

    // Scroll state
    this.scrollAccumulator = 0;
    this.scrollSensitivity = 0.001;
    this.isScrolling = false;
    this.scrollTimeout = null;

    // Car (player) representation
    this.car = this.createCar();

    this.setupEventListeners();
  }

  createCar() {
    const group = new THREE.Group();

    // Shared material for all wireframe parts using LineMaterial (supports linewidth)
    const lineMaterial = new LineMaterial({
      color: 0x03a062, // Cyan color for wireframe
      linewidth: 0.03, // Line width in world units (not pixels)
      worldUnits: true, // Use world units for line width
      dashed: false,
    });

    // Helper function to convert EdgesGeometry to LineSegmentsGeometry
    const createLineSegmentsGeometry = (edgesGeometry: THREE.EdgesGeometry) => {
      const positions = edgesGeometry.attributes.position.array;
      const lineSegmentsGeometry = new LineSegmentsGeometry();
      lineSegmentsGeometry.setPositions(Array.from(positions));
      return lineSegmentsGeometry;
    };

    // Main body (chassis) - lower part
    const bodyGeometry = new THREE.BoxGeometry(2, 0.8, 4);
    const bodyEdges = new THREE.EdgesGeometry(bodyGeometry);
    const bodyLineGeometry = createLineSegmentsGeometry(bodyEdges);
    const bodyWireframe = new LineSegments2(bodyLineGeometry, lineMaterial);
    bodyWireframe.position.y = 0.8; // Raised above ground to make room for wheels
    bodyWireframe.layers.set(1);
    group.add(bodyWireframe);

    // Cabin/roof - upper part (smaller and centered)
    const cabinGeometry = new THREE.BoxGeometry(1.6, 1, 2.5);
    const cabinEdges = new THREE.EdgesGeometry(cabinGeometry);
    const cabinLineGeometry = createLineSegmentsGeometry(cabinEdges);
    const cabinWireframe = new LineSegments2(cabinLineGeometry, lineMaterial);
    cabinWireframe.position.y = 1.7; // On top of the body
    cabinWireframe.position.z = -0.3; // Slightly back from center
    cabinWireframe.layers.set(1);
    group.add(cabinWireframe);

    // Wheels - 4 cylinders
    const wheelRadius = 0.4;
    const wheelWidth = 0.3;
    const wheelGeometry = new THREE.CylinderGeometry(
      wheelRadius,
      wheelRadius,
      wheelWidth,
      4
    );

    // Wheel positions (x, z relative to car center)
    const wheelPositions = [
      { x: -1.1, z: 1.3 }, // Front left
      { x: 1.1, z: 1.3 }, // Front right
      { x: -1.1, z: -1.3 }, // Back left
      { x: 1.1, z: -1.3 }, // Back right
    ];

    wheelPositions.forEach((pos) => {
      const wheelEdges = new THREE.EdgesGeometry(wheelGeometry);
      const wheelLineGeometry = createLineSegmentsGeometry(wheelEdges);
      const wheelWireframe = new LineSegments2(wheelLineGeometry, lineMaterial);
      wheelWireframe.position.set(pos.x, wheelRadius, pos.z);
      wheelWireframe.rotation.z = Math.PI / 2; // Rotate to align with car direction
      wheelWireframe.layers.set(3);
      group.add(wheelWireframe);
    });

    group.scale.set(0.8, 0.8, 0.8);

    group.position.x = CAR_X_OFFSET;

    const wrappingGroup = new THREE.Group();
    wrappingGroup.add(group);
    this.highwaySystem.scene.add(wrappingGroup);
    return wrappingGroup;
  }

  setupEventListeners() {
    // Keyboard controls
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));

    // Mouse wheel / trackpad scroll
    window.addEventListener('wheel', (e) => this.handleWheel(e), {
      passive: false,
    });

    // Touch events for mobile
    let touchStartY = 0;
    let isTouchScrolling = false;

    window.addEventListener('touchstart', (e) => {
      // Support both single finger and two finger scrolling
      if (e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
        isTouchScrolling = true;
      } else if (e.touches.length === 2) {
        touchStartY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        isTouchScrolling = true;
      }
    });

    window.addEventListener(
      'touchmove',
      (e) => {
        if (!isTouchScrolling) return;

        if (e.touches.length === 1) {
          // Single finger scroll
          e.preventDefault();
          const currentY = e.touches[0].clientY;
          const delta = touchStartY - currentY;
          this.handleScroll(delta * 0.5); // Adjust sensitivity for single finger
          touchStartY = currentY;
        } else if (e.touches.length === 2) {
          // Two finger scroll (pinch/zoom gesture)
          e.preventDefault();
          const currentY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          const delta = touchStartY - currentY;
          this.handleScroll(delta * 2);
          touchStartY = currentY;
        }
      },
      { passive: false }
    );

    window.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) {
        isTouchScrolling = false;
      }
    });
  }

  handleKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.keys.forward = true;
        event.preventDefault();
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this.keys.backward = true;
        event.preventDefault();
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.keys.left = true;
        event.preventDefault();
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.keys.right = true;
        event.preventDefault();
        break;
    }
  }

  handleKeyUp(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.keys.forward = false;
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this.keys.backward = false;
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.keys.left = false;
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.keys.right = false;
        break;
    }
  }

  handleWheel(event: WheelEvent) {
    event.preventDefault();
    this.handleScroll(event.deltaY);
  }

  handleScroll(delta: number) {
    if (this.linearScrollMode) {
      // Linear scroll mode - directly update position like a webpage
      this.currentT += delta * this.linearScrollSensitivity;

      // Keep position within bounds
      this.currentT = Math.max(0, Math.min(1, this.currentT));

      // Update positions immediately
      this.updateCarPosition();
      this.updateCameraPosition();
    } else {
      // Original acceleration-based scrolling
      this.scrollAccumulator += delta * this.scrollSensitivity;
      this.isScrolling = true;

      // Clear previous timeout
      if (this.scrollTimeout) {
        clearTimeout(this.scrollTimeout);
      }

      // Stop scrolling after a delay
      this.scrollTimeout = setTimeout(() => {
        this.isScrolling = false;
        this.scrollAccumulator = 0;
      }, 150);
    }
  }

  update(deltaTime: number) {
    // Skip speed-based updates if in linear scroll mode
    if (this.linearScrollMode) {
      // Only handle keyboard input for linear mode
      if (this.keys.forward) {
        this.currentT += this.maxSpeed * deltaTime;
      } else if (this.keys.backward) {
        this.currentT -= this.maxSpeed * 0.5 * deltaTime;
      }
    } else {
      // Original acceleration-based movement
      // Update target speed based on input
      if (this.keys.forward || this.scrollAccumulator > 0) {
        this.targetSpeed = this.maxSpeed;
      } else if (this.keys.backward || this.scrollAccumulator < 0) {
        this.targetSpeed = -this.maxSpeed * 0.5; // Reverse is slower
      } else {
        this.targetSpeed = 0;
      }

      // Apply scroll accumulator
      if (this.isScrolling) {
        const scrollSpeed =
          Math.sign(this.scrollAccumulator) *
          Math.min(Math.abs(this.scrollAccumulator), this.maxSpeed);
        this.targetSpeed = scrollSpeed;
      }

      // Smooth acceleration/deceleration
      if (Math.abs(this.targetSpeed - this.speed) > 0.001) {
        const accel =
          this.targetSpeed > this.speed ? this.acceleration : this.deceleration;
        this.speed += (this.targetSpeed - this.speed) * accel;
      } else {
        this.speed = this.targetSpeed;
      }

      // Update position along spline
      this.currentT += this.speed * deltaTime;
    }

    // Handle branch transitions
    if (this.currentT > 1) {
      // Check for exits at current position
      const exits = this.highwaySystem.getExitsAtPosition(
        this.currentBranchId,
        1,
        0.1
      );

      if (exits.length > 0 && this.keys.right) {
        // Take the exit
        const exit = exits[0];
        const result = this.highwaySystem.switchBranch(
          exit.toBranch,
          exit.toT || 0
        );
        if (result) {
          this.currentBranchId = exit.toBranch;
          this.currentT = result.startT;
        }
      } else {
        // Loop back to start of current branch
        this.currentT = 0;
      }
    } else if (this.currentT < 0) {
      this.currentT = 0;
      this.speed = 0;
    }

    // Update car and camera positions
    this.updateCarPosition();
    this.updateCameraPosition();
  }

  updateCarPosition() {
    const branch = this.highwaySystem.getBranch(this.currentBranchId);
    if (!branch) return;

    const position = branch.getPoint(this.currentT);
    const tangent = branch.getTangent(this.currentT);

    // Position car
    this.car.position.copy(position);
    // No additional y offset needed - wireframe box is already positioned correctly

    // Orient car along road
    const lookAtPoint = position.clone().add(tangent);
    this.car.lookAt(lookAtPoint);

    // Ensure ground plane follows car position, safely
    const app = (window as any).app;
    if (
      app &&
      app.sceneManager &&
      typeof app.sceneManager.updateGroundPosition === 'function'
    ) {
      app.sceneManager.updateGroundPosition(position.x, position.z);
    }
  }

  updateCameraPosition() {
    const branch = this.highwaySystem.getBranch(this.currentBranchId);
    if (!branch) return;

    // Get current position and look-ahead position
    const currentPos = branch.getPoint(this.currentT);
    const lookAheadT = Math.min(this.currentT + this.cameraLookAhead, 1);
    const lookAheadPos = branch.getPoint(lookAheadT);
    const tangent = branch.getTangent(this.currentT);

    // Position camera behind and above the car
    const cameraOffset = tangent.clone().multiplyScalar(-this.cameraDistance);
    cameraOffset.y = this.cameraHeight;

    // Smooth camera movement
    const targetCameraPos = currentPos.clone().add(cameraOffset);
    // this.camera.position.lerp(targetCameraPos, 0.1);
    this.camera.position.copy(targetCameraPos);

    // Look slightly ahead of the car
    const lookTarget = lookAheadPos.clone();
    // lookTarget.y += 1;
    this.camera.lookAt(lookTarget);
  }

  getCurrentPosition() {
    return {
      branchId: this.currentBranchId,
      t: this.currentT,
      speed: this.speed,
    };
  }

  setPosition(branchId: string, t: number) {
    if (this.highwaySystem.getBranch(branchId)) {
      this.currentBranchId = branchId;
      this.currentT = Math.max(0, Math.min(1, t));
      this.speed = 0;
      this.targetSpeed = 0;
      this.scrollAccumulator = 0;
    }
  }

  dispose() {
    // Remove event listeners
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('wheel', this.handleWheel);

    // Dispose of car
    this.car.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry)
        child.geometry.dispose();
      if (child instanceof THREE.Mesh && child.material)
        child.material.dispose();
    });

    if (this.car.parent) {
      this.car.parent.remove(this.car);
    }
  }
}
