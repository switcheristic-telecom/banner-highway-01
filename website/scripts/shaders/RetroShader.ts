import * as THREE from 'three';

export const RetroShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    colorNum: { value: 4.0 },
    pixelSize: { value: 2.0 },
    maskIntensity: { value: 0.5 },
    blending: { value: true },
  },

  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    precision highp float;

    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float colorNum;
    uniform float pixelSize;
    uniform float maskIntensity;
    uniform bool blending;

    varying vec2 vUv;

    const float bayerMatrix8x8[64] = float[64](
      0.0/64.0, 48.0/64.0, 12.0/64.0, 60.0/64.0,  3.0/64.0, 51.0/64.0, 15.0/64.0, 63.0/64.0,
      32.0/64.0, 16.0/64.0, 44.0/64.0, 28.0/64.0, 35.0/64.0, 19.0/64.0, 47.0/64.0, 31.0/64.0,
      8.0/64.0, 56.0/64.0,  4.0/64.0, 52.0/64.0, 11.0/64.0, 59.0/64.0,  7.0/64.0, 55.0/64.0,
      40.0/64.0, 24.0/64.0, 36.0/64.0, 20.0/64.0, 43.0/64.0, 27.0/64.0, 39.0/64.0, 23.0/64.0,
      2.0/64.0, 50.0/64.0, 14.0/64.0, 62.0/64.0,  1.0/64.0, 49.0/64.0, 13.0/64.0, 61.0/64.0,
      34.0/64.0, 18.0/64.0, 46.0/64.0, 30.0/64.0, 33.0/64.0, 17.0/64.0, 45.0/64.0, 29.0/64.0,
      10.0/64.0, 58.0/64.0,  6.0/64.0, 54.0/64.0,  9.0/64.0, 57.0/64.0,  5.0/64.0, 53.0/64.0,
      42.0/64.0, 26.0/64.0, 38.0/64.0, 22.0/64.0, 41.0/64.0, 25.0/64.0, 37.0/64.0, 21.0/64.0
    );

    vec3 dither(vec2 uv, vec3 color) {
      int x = int(uv.x * resolution.x) % 8;
      int y = int(uv.y * resolution.y) % 8;
      float threshold = bayerMatrix8x8[y * 8 + x];

      color.rgb += threshold * 0.6;
      color.r = floor(color.r * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
      color.g = floor(color.g * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
      color.b = floor(color.b * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);

      return color;
    }

    const float MASK_BORDER = 0.9;

    void main() {
      // XOR shader CRT mask
      vec2 pixel = vUv * resolution;
      vec2 coord = pixel / pixelSize;
      vec2 subcoord = coord * vec2(3.0, 1.0);
      vec2 cellOffset = vec2(0.0, mod(floor(coord.x), 3.0) * 0.5);

      float ind = mod(floor(subcoord.x), 3.0);
      vec3 maskColor = vec3(ind == 0.0, ind == 1.0, ind == 2.0) * 2.0;

      vec2 cellUv = fract(subcoord + cellOffset) * 2.0 - 1.0;
      vec2 border = 1.0 - cellUv * cellUv * MASK_BORDER;
      maskColor.rgb *= border.x * border.y;

      vec2 rgbCellUV = floor(coord + cellOffset) * pixelSize / resolution;

      vec4 color = texture2D(tDiffuse, rgbCellUV);
      color.rgb = dither(rgbCellUV, color.rgb);

      if (blending) {
        color.rgb *= 1.0 + (maskColor - 1.0) * maskIntensity;
      } else {
        color.rgb *= maskColor;
      }

      gl_FragColor = color;
    }
  `,
};
