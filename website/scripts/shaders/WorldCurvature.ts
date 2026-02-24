import * as THREE from 'three';

const DEFAULT_CURVATURE = 0.0004;

const CURVED_PROJECT_VERTEX = /* glsl */ `
  vec4 mvPosition = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    mvPosition = batchingMatrix * mvPosition;
  #endif
  #ifdef USE_INSTANCING
    mvPosition = instanceMatrix * mvPosition;
  #endif

  // World curvature - bend the world downward with distance from camera
  vec4 _wPos = modelMatrix * mvPosition;
  float _dist = distance(_wPos.xz, cameraPosition.xz);
  _wPos.y -= _dist * _dist * curvatureStrength;
  mvPosition = viewMatrix * _wPos;

  gl_Position = projectionMatrix * mvPosition;
`;

export function applyCurvature(
  material: THREE.Material,
  strength: number = DEFAULT_CURVATURE,
) {
  const prevOnBeforeCompile = material.onBeforeCompile;

  material.onBeforeCompile = (shader, renderer) => {
    if (prevOnBeforeCompile) {
      prevOnBeforeCompile.call(material, shader, renderer);
    }

    shader.uniforms.curvatureStrength = { value: strength };

    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      'uniform float curvatureStrength;\nvoid main() {',
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      CURVED_PROJECT_VERTEX,
    );
  };

  material.needsUpdate = true;
}
