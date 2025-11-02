import * as THREE from 'three';

export const SkyGradientShader = {
  uniforms: {
    topColor: { value: new THREE.Color(0xffffff) }, // White at top
    bottomColor: { value: new THREE.Color(0x808080) }, // Gray at bottom
    offset: { value: 0.0 },
    exponent: { value: 0.6 },
    time: { value: 0.0 },
    cloudQuantization: { value: 20.0 }, // Higher = more blocky
  },

  vertexShader: `
    varying vec3 vWorldPosition;
    varying vec3 vPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vPosition = position; // Use local position for stable stars
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
    
    // Simple noise function
    float noise(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    
    // Smooth noise (interpolated)
    float smoothNoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      
      // Smooth interpolation
      f = f * f * (3.0 - 2.0 * f);
      
      // Get noise at corners
      float a = noise(i);
      float b = noise(i + vec2(1.0, 0.0));
      float c = noise(i + vec2(0.0, 1.0));
      float d = noise(i + vec2(1.0, 1.0));
      
      // Bilinear interpolation
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    
    // Layered noise with medium detail (3 octaves)
    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;
      
      for (int i = 0; i < 3; i++) {
        value += amplitude * smoothNoise(p);
        p *= 2.0;
        amplitude *= 0.5;
      }
      
      return value;
    }
    
    void main() {
      float h = normalize(vWorldPosition + offset).y;
      h = pow(max(0.0, h), exponent);
      vec3 color = mix(bottomColor, topColor, h);
      
      // Use spherical coordinates to avoid stretching
      vec3 normalized = normalize(vPosition);
      float u = atan(normalized.x, normalized.z) / 6.28318; // longitude
      float v = asin(normalized.y) / 3.14159 + 0.5; // latitude
      
      // Generate clouds using noise with time-based movement
      vec2 cloudCoord = vec2(u, v) * 5.0; // Scale for cloud size
      cloudCoord.x += time * 0.05; // Move clouds over time
      
      // Apply quantization for blocky effect
      cloudCoord = floor(cloudCoord * cloudQuantization) / cloudQuantization;
      
      float cloudNoise = fbm(cloudCoord);
      
      // Create cloud shape - only show where noise is high
      float cloudMask = smoothstep(0.5, 0.7, cloudNoise);
      
      // White clouds
      vec3 cloudColor = vec3(0.2);
      color = mix(color, cloudColor, cloudMask * 0.8);
      
      gl_FragColor = vec4(color, 1.0);
    }
  `,
};
