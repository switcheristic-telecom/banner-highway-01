import * as THREE from 'three';

export const SkyGradientShader = {
  uniforms: {
    topColor: { value: new THREE.Color(0xffffff) },
    bottomColor: { value: new THREE.Color(0x808080) },
    offset: { value: 0.0 },
    exponent: { value: 0.6 },
    time: { value: 0.0 },
    cloudQuantization: { value: 20.0 },
  },

  vertexShader: `
    varying vec3 vWorldPosition;
    varying vec3 vPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vPosition = position;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,

  fragmentShader: `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform float offset;
    uniform float exponent;
    uniform float time;
    uniform float cloudQuantization;

    varying vec3 vWorldPosition;
    varying vec3 vPosition;

    float noise3D(vec3 p) {
      return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
    }

    float smoothNoise3D(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);

      float n000 = noise3D(i);
      float n100 = noise3D(i + vec3(1.0, 0.0, 0.0));
      float n010 = noise3D(i + vec3(0.0, 1.0, 0.0));
      float n110 = noise3D(i + vec3(1.0, 1.0, 0.0));
      float n001 = noise3D(i + vec3(0.0, 0.0, 1.0));
      float n101 = noise3D(i + vec3(1.0, 0.0, 1.0));
      float n011 = noise3D(i + vec3(0.0, 1.0, 1.0));
      float n111 = noise3D(i + vec3(1.0, 1.0, 1.0));

      float nx00 = mix(n000, n100, f.x);
      float nx10 = mix(n010, n110, f.x);
      float nx01 = mix(n001, n101, f.x);
      float nx11 = mix(n011, n111, f.x);

      float nxy0 = mix(nx00, nx10, f.y);
      float nxy1 = mix(nx01, nx11, f.y);

      return mix(nxy0, nxy1, f.z);
    }

    float fbm3D(vec3 p) {
      float value = 0.0;
      float amplitude = 0.5;
      for (int i = 0; i < 3; i++) {
        value += amplitude * smoothNoise3D(p);
        p *= 2.0;
        amplitude *= 0.5;
      }
      return value;
    }

    void main() {
      float h = normalize(vWorldPosition + offset).y;
      h = pow(max(0.0, h), exponent);
      vec3 color = mix(bottomColor, topColor, h);

      vec3 cloudPos = normalize(vPosition) * 5.0;
      cloudPos.x += time * 0.05;
      cloudPos = floor(cloudPos * cloudQuantization) / cloudQuantization;

      float cloudNoise = fbm3D(cloudPos);
      float cloudMask = smoothstep(0.5, 0.7, cloudNoise);

      vec3 cloudColor = vec3(0.2);
      color = mix(color, cloudColor, cloudMask * 0.8);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};
