import * as THREE from 'three';

export const SkyGradientShader = {
  uniforms: {
    topColor: { value: new THREE.Color(0xffffff) }, // White at top
    bottomColor: { value: new THREE.Color(0x808080) }, // Gray at bottom
    offset: { value: 0.0 },
    exponent: { value: 0.6 },
  },

  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,

  fragmentShader: `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform float offset;
    uniform float exponent;
    
    varying vec3 vWorldPosition;
    
    void main() {
      float h = normalize(vWorldPosition + offset).y;
      h = pow(max(0.0, h), exponent);
      gl_FragColor = vec4(mix(bottomColor, topColor, h), 1.0);
    }
  `,
};
