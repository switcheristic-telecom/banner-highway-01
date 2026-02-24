import * as THREE from 'three';
import { RoadMesh } from './RoadMesh';
import { RoadSpline } from '../../shared/road-spline';
import type { Road, RoadNetwork, RoadJunction } from '../../shared/types';
import { applyCurvature } from '../shaders/WorldCurvature';

const ROAD_BLOCK_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x03a062,
  roughness: 0.8,
  metalness: 0.0,
  emissive: 0x03a062,
  emissiveIntensity: 0.3,
});
applyCurvature(ROAD_BLOCK_MATERIAL);

const ROAD_EDGE_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x03a062,
  emissive: 0x03a062,
  emissiveIntensity: 0.5,
  side: THREE.DoubleSide,
});
applyCurvature(ROAD_EDGE_MATERIAL);

export class RoadSystem {
  scene: THREE.Scene;
  roads: Map<string, RoadSpline>;
  meshes: Map<string, RoadMesh>;
  junctions: RoadJunction[];
  currentRoad: string | null;
  showEdge: boolean;
  showBlock: boolean;
  group: THREE.Group;
  edgeGroup: THREE.Group;
  blockGroup: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.roads = new Map();
    this.meshes = new Map();
    this.junctions = [];
    this.currentRoad = null;

    this.showEdge = true;
    this.showBlock = false;

    this.group = new THREE.Group();
    this.group.name = 'RoadSystem';
    this.edgeGroup = new THREE.Group();
    this.edgeGroup.name = 'EdgeLines';
    this.edgeGroup.visible = this.showEdge;
    this.blockGroup = new THREE.Group();
    this.blockGroup.name = 'Blocks';
    this.blockGroup.visible = this.showBlock;

    this.group.add(this.edgeGroup);
    this.group.add(this.blockGroup);
    this.scene.add(this.group);
  }

  loadNetwork(network: RoadNetwork) {
    this.clear();

    for (const road of network.roads) {
      this.createRoad(road);
    }

    if (network.junctions) {
      this.junctions = network.junctions;
      this.createJunctionMarkers();
    }

    if (network.roads.length > 0) {
      this.currentRoad = network.roads[0].id;
    }
  }

  createRoad(roadData: Road) {
    const spline = new RoadSpline(
      roadData.waypoints,
      roadData.id,
      roadData.isCyclic,
    );
    this.roads.set(roadData.id, spline);

    const mesh = new RoadMesh(spline, {
      width: roadData.width,
      segments: roadData.segmentCount,
      blockMaterial: ROAD_BLOCK_MATERIAL,
      edgeMaterial: ROAD_EDGE_MATERIAL,
    });

    mesh.blockMesh.layers.set(3);
    mesh.blockMesh.castShadow = true;
    mesh.blockMesh.receiveShadow = true;

    this.meshes.set(roadData.id, mesh);
    this.blockGroup.add(mesh.blockMesh);
    this.edgeGroup.add(mesh.edgeLinesGroup);
  }

  private createJunctionMarkers() {
    const markerGeometry = new THREE.ConeGeometry(1, 3, 8);
    const markerMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      emissive: 0x00ff00,
      emissiveIntensity: 0.8,
    });

    for (const jn of this.junctions) {
      const fromRoad = this.roads.get(jn.fromRoad);
      const toRoad = this.roads.get(jn.toRoad);
      if (!fromRoad || !toRoad) continue;

      const pt = fromRoad.getPoint(jn.fromT);
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(pt.x, 3, pt.z);
      marker.rotation.z = Math.PI;

      marker.userData = {
        type: 'junction',
        fromRoad: jn.fromRoad,
        toRoad: jn.toRoad,
        fromT: jn.fromT,
        toT: jn.toT,
      };

      marker.layers.set(0);
      this.group.add(marker);
    }
  }

  getRoad(roadId: string) {
    return this.roads.get(roadId);
  }

  getCurrentRoad() {
    return this.roads.get(this.currentRoad ?? '');
  }

  getJunctionsAtPosition(roadId: string, t: number, threshold = 0.05) {
    return this.junctions.filter(
      (jn) => jn.fromRoad === roadId && Math.abs(jn.fromT - t) < threshold
    );
  }

  switchRoad(newRoadId: string, startT = 0) {
    if (this.roads.has(newRoadId)) {
      this.currentRoad = newRoadId;
      return { road: this.roads.get(newRoadId)!, startT };
    }
    return null;
  }

  getPositionOnRoad(roadId: string, t: number) {
    const road = this.roads.get(roadId ?? '');
    if (!road) return null;

    const pt = road.getPoint(t);
    const tan = road.getTangent(t);
    const n = road.getNormal(t);

    return {
      position: new THREE.Vector3(pt.x, 0, pt.z),
      tangent: new THREE.Vector3(tan.x, 0, tan.z),
      normal: new THREE.Vector3(n.x, 0, n.z),
      up: new THREE.Vector3(0, 1, 0),
    };
  }

  toggleEdgeLines(show?: boolean) {
    this.showEdge = show !== undefined ? show : !this.showEdge;
    this.edgeGroup.visible = this.showEdge;
    return this.showEdge;
  }

  toggleBlocks(show?: boolean) {
    this.showBlock = show !== undefined ? show : !this.showBlock;
    this.blockGroup.visible = this.showBlock;
    return this.showBlock;
  }

  setEdgeVisibility(visible: boolean) {
    this.showEdge = visible;
    this.edgeGroup.visible = visible;
  }

  setBlockVisibility(visible: boolean) {
    this.showBlock = visible;
    this.blockGroup.visible = visible;
  }

  clear() {
    const disposeGroup = (group: THREE.Group) => {
      while (group.children.length > 0) {
        const child = group.children[0];
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
        group.remove(child);
      }
    };

    disposeGroup(this.edgeGroup);
    disposeGroup(this.blockGroup);

    // Remove junction markers etc
    const extra = this.group.children.filter(
      (c) => c !== this.edgeGroup && c !== this.blockGroup
    );
    for (const child of extra) {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
      this.group.remove(child);
    }

    this.roads.clear();
    this.meshes.clear();
    this.junctions = [];
    this.currentRoad = null;
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
  }
}
