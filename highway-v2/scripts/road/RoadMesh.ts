import * as THREE from 'three';
import { RoadSpline } from '../../shared/road-spline';

interface RoadMeshOptions {
  width: number;
  segments: number;
  blockMaterial: THREE.Material;
  edgeMaterial: THREE.Material;
}

export class RoadMesh {
  spline: RoadSpline;
  width: number;
  segments: number;
  blockMaterial: THREE.Material;
  blockMesh: THREE.Mesh;
  edgeMaterial: THREE.Material;
  edgeLinesGroup: THREE.Group;

  constructor(spline: RoadSpline, options: RoadMeshOptions) {
    this.spline = spline;
    this.width = options.width;
    this.segments = options.segments;
    this.blockMaterial = options.blockMaterial;
    this.edgeMaterial = options.edgeMaterial;

    this.blockMesh = this.createBlockMesh();
    this.edgeLinesGroup = this.createEdgeLinesGroup();
  }

  private createBlockMesh() {
    const geometry = this.createBlockGeometry();
    const blockMesh = new THREE.Mesh(geometry, this.blockMaterial);
    blockMesh.receiveShadow = true;
    blockMesh.castShadow = false;
    return blockMesh;
  }

  private createBlockGeometry() {
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= this.segments; i++) {
      const t = i / this.segments;
      const pt = this.spline.getPoint(t);
      const n = this.spline.getNormal(t);
      const halfWidth = this.width / 2;

      // Left side
      vertices.push(pt.x + n.x * -halfWidth, 0, pt.z + n.z * -halfWidth);
      // Right side
      vertices.push(pt.x + n.x * halfWidth, 0, pt.z + n.z * halfWidth);

      normals.push(0, 1, 0);
      normals.push(0, 1, 0);

      uvs.push(0, t);
      uvs.push(1, t);
    }

    for (let i = 0; i < this.segments; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();

    return geometry;
  }

  private createEdgeLinesGroup() {
    const edgeLinesGroup = new THREE.Group();
    const halfWidth = this.width / 2;
    const lineThickness = 0.15;

    const middleEdgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x03a062,
      emissive: 0x03a062,
      emissiveIntensity: 0.0,
      transparent: true,
      opacity: 0.5,
    });

    const leftVertices: number[] = [];
    const leftIndices: number[] = [];
    const leftNormals: number[] = [];
    const leftUvs: number[] = [];

    const rightVertices: number[] = [];
    const rightIndices: number[] = [];
    const rightNormals: number[] = [];
    const rightUvs: number[] = [];

    const middleVertices: number[] = [];
    const middleIndices: number[] = [];
    const middleNormals: number[] = [];
    const middleUvs: number[] = [];

    for (let i = 0; i <= this.segments; i++) {
      const t = i / this.segments;
      const pt = this.spline.getPoint(t);
      const n = this.spline.getNormal(t);
      const y = 0.05;

      // Left edge
      const loX = pt.x + n.x * (-halfWidth - lineThickness / 2);
      const loZ = pt.z + n.z * (-halfWidth - lineThickness / 2);
      const liX = pt.x + n.x * (-halfWidth + lineThickness / 2);
      const liZ = pt.z + n.z * (-halfWidth + lineThickness / 2);
      leftVertices.push(loX, y, loZ);
      leftVertices.push(liX, y, liZ);
      leftNormals.push(0, 1, 0, 0, 1, 0);
      leftUvs.push(0, t, 1, t);

      // Right edge
      const riX = pt.x + n.x * (halfWidth - lineThickness / 2);
      const riZ = pt.z + n.z * (halfWidth - lineThickness / 2);
      const roX = pt.x + n.x * (halfWidth + lineThickness / 2);
      const roZ = pt.z + n.z * (halfWidth + lineThickness / 2);
      rightVertices.push(riX, y, riZ);
      rightVertices.push(roX, y, roZ);
      rightNormals.push(0, 1, 0, 0, 1, 0);
      rightUvs.push(0, t, 1, t);

      // Middle edge
      const mlX = pt.x + n.x * (-lineThickness / 2);
      const mlZ = pt.z + n.z * (-lineThickness / 2);
      const mrX = pt.x + n.x * (lineThickness / 2);
      const mrZ = pt.z + n.z * (lineThickness / 2);
      middleVertices.push(mlX, y, mlZ);
      middleVertices.push(mrX, y, mrZ);
      middleNormals.push(0, 1, 0, 0, 1, 0);
      middleUvs.push(0, t, 1, t);
    }

    for (let i = 0; i < this.segments; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;

      leftIndices.push(a, b, c);
      leftIndices.push(b, d, c);
      rightIndices.push(a, b, c);
      rightIndices.push(b, d, c);
      middleIndices.push(a, b, c);
      middleIndices.push(b, d, c);
    }

    // Left edge mesh
    const leftGeometry = new THREE.BufferGeometry();
    leftGeometry.setAttribute('position', new THREE.Float32BufferAttribute(leftVertices, 3));
    leftGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(leftNormals, 3));
    leftGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(leftUvs, 2));
    leftGeometry.setIndex(leftIndices);
    const leftMesh = new THREE.Mesh(leftGeometry, this.edgeMaterial);
    leftMesh.layers.set(3);
    edgeLinesGroup.add(leftMesh);

    // Right edge mesh
    const rightGeometry = new THREE.BufferGeometry();
    rightGeometry.setAttribute('position', new THREE.Float32BufferAttribute(rightVertices, 3));
    rightGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(rightNormals, 3));
    rightGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(rightUvs, 2));
    rightGeometry.setIndex(rightIndices);
    const rightMesh = new THREE.Mesh(rightGeometry, this.edgeMaterial.clone());
    rightMesh.layers.set(3);
    edgeLinesGroup.add(rightMesh);

    // Middle edge mesh
    const middleGeometry = new THREE.BufferGeometry();
    middleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(middleVertices, 3));
    middleGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(middleNormals, 3));
    middleGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(middleUvs, 2));
    middleGeometry.setIndex(middleIndices);
    const middleMesh = new THREE.Mesh(middleGeometry, middleEdgeMaterial);
    middleMesh.layers.set(1);
    edgeLinesGroup.add(middleMesh);

    return edgeLinesGroup;
  }

  dispose() {
    this.blockMesh.geometry.dispose();
    this.edgeLinesGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
    this.blockMaterial.dispose();
    this.edgeMaterial.dispose();
  }
}
