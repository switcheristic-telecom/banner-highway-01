import * as THREE from 'three';

/**
 * SkyGradientShader — Animated skybox with 4 distinct visual effects and crossfade transitions.
 *
 * Rendered on a large BackSide sphere. All effects use 3D noise sampled directly on the
 * sphere's local position to avoid the seam that occurs with atan2-based UV unwrapping.
 *
 * Uniforms:
 *   progress (0.0–3.999)     — Selects the active effect. floor(progress) = part index,
 *                               fract(progress) = position within that part.
 *   transitionInterval (0.05) — Fraction of each part used for crossfade. At the first 5%
 *                               of each part, the shader blends from the previous effect
 *                               into the current one using smoothstep.
 *   time                      — Elapsed time driving all animations.
 *   cloudQuantization         — Controls the blocky pixelation in Effect 0.
 *   topColor / bottomColor    — Base vertical gradient (sky background).
 *   offset / exponent         — Shape the gradient falloff curve.
 *
 * Effects:
 *   0 — Blocky Clouds:   Quantized FBM noise → dark cloud silhouettes.
 *   1 — Starfield:       High-freq hash grid for stars (with twinkle) + domain-warped FBM nebula.
 *   2 — Voronoi Cells:   3D Voronoi with edge detection → stained-glass / cracked pattern.
 *   3 — Aurora Waves:    Layered sin bands modulated by FBM → flowing green-to-purple curtains.
 *
 * Transition logic (in main()):
 *   partIndex = floor(progress)          — which of the 4 effects is active
 *   localT   = fract(progress)           — how far into the current part (0–1)
 *   prev     = (partIndex - 1) mod 4     — the effect we're transitioning FROM
 *
 *   When localT < transitionInterval, both the current and previous effects are evaluated
 *   and blended: mix(prevEffect, currentEffect, smoothstep(0, transitionInterval, localT)).
 *   Outside the transition zone, only the current effect is computed.
 *
 *   The result is added onto the base gradient: finalColor = baseGradient + effect.
 */
export const SkyGradientShader = {
  uniforms: {
    topColor: { value: new THREE.Color(0xffffff) },
    bottomColor: { value: new THREE.Color(0x808080) },
    offset: { value: 0.0 },
    exponent: { value: 0.6 },
    time: { value: 0.0 },
    cloudQuantization: { value: 20.0 },
    progress: { value: 0.0 },
    prevEffectIndex: { value: 0.0 },
    transitionInterval: { value: 0.05 },
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
    uniform float progress;
    uniform float prevEffectIndex;
    uniform float transitionInterval;

    varying vec3 vWorldPosition;
    varying vec3 vPosition;

    // ─── Shared noise primitives ───

    float hash3D(vec3 p) {
      return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
    }

    float smoothNoise3D(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);

      float n000 = hash3D(i);
      float n100 = hash3D(i + vec3(1.0, 0.0, 0.0));
      float n010 = hash3D(i + vec3(0.0, 1.0, 0.0));
      float n110 = hash3D(i + vec3(1.0, 1.0, 0.0));
      float n001 = hash3D(i + vec3(0.0, 0.0, 1.0));
      float n101 = hash3D(i + vec3(1.0, 0.0, 1.0));
      float n011 = hash3D(i + vec3(0.0, 1.0, 1.0));
      float n111 = hash3D(i + vec3(1.0, 1.0, 1.0));

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

    // ─── Effect 0: Blocky Clouds ───

    vec3 effectBlockyClouds(vec3 pos, float t) {
      vec3 cloudPos = pos * 5.0;
      cloudPos.x += t * 0.5;
      cloudPos = floor(cloudPos * cloudQuantization) / cloudQuantization;

      float cloudNoise = fbm3D(cloudPos);
      float cloudMask = smoothstep(0.5, 0.7, cloudNoise);

      return vec3(cloudMask * 0.8 * -0.8);
    }

    // ─── Effect 1: Starfield + Nebula ───

    vec3 effectStarfield(vec3 pos, float t) {
      // Stars: use high-frequency hash for sharp points
      vec3 starPos = pos * 80.0;
      vec3 cell = floor(starPos);
      float starHash = hash3D(cell);
      float star = step(0.985, starHash);
      // Twinkle
      float twinkle = sin(t * 3.0 + starHash * 100.0) * 0.5 + 0.5;
      star *= twinkle;

      // Nebula: domain-warped low-frequency FBM
      vec3 nebulaPos = pos * 3.0;
      nebulaPos += vec3(fbm3D(nebulaPos + t * 0.02), fbm3D(nebulaPos + 50.0), fbm3D(nebulaPos + 100.0)) * 0.5;
      float nebula = fbm3D(nebulaPos);
      nebula = smoothstep(0.3, 0.7, nebula) * 0.15;

      return vec3(star + nebula);
    }

    // ─── Effect 2: Lightning / Cracks ───

    vec3 effectLightning(vec3 pos, float t) {
      // Ridged noise: abs(fbm) inverted creates sharp valley lines
      vec3 p1 = pos * 6.0 + t * 0.08;
      vec3 p2 = pos * 6.0 + vec3(50.0) + t * 0.05;
      float n1 = 1.0 - abs(fbm3D(p1) * 2.0 - 1.0);
      float n2 = 1.0 - abs(fbm3D(p2) * 2.0 - 1.0);

      // Sharpen the ridges into thin bright lines
      float crack1 = pow(n1, 12.0);
      float crack2 = pow(n2, 12.0);
      float cracks = max(crack1, crack2);

      // Occasional flash: pulse brightness over time
      float flash = pow(sin(t * 0.4) * 0.5 + 0.5, 8.0) * 0.3;

      return vec3(cracks * 0.2 + flash * cracks);
    }

    // ─── Effect 3: Aurora Waves ───

    vec3 effectAurora(vec3 pos, float t) {
      vec3 normalized = normalize(pos);
      float elevation = normalized.y;

      // Multiple wave layers at different frequencies
      float wave1 = sin(elevation * 12.0 + t * 0.5 + fbm3D(pos * 3.0 + t * 0.1) * 3.0);
      float wave2 = sin(elevation * 8.0 - t * 0.3 + fbm3D(pos * 2.0 + 20.0) * 2.0);
      float wave3 = sin(elevation * 20.0 + t * 0.7 + fbm3D(pos * 5.0 + 40.0) * 1.5);

      float band = smoothstep(0.3, 0.8, wave1 * 0.5 + 0.5) * 0.6;
      band += smoothstep(0.4, 0.9, wave2 * 0.5 + 0.5) * 0.3;
      band += smoothstep(0.5, 0.95, wave3 * 0.5 + 0.5) * 0.15;

      return vec3(band * 0.3);
    }

    // ─── Main ───

    void main() {
      float h = normalize(vWorldPosition + offset).y;
      h = pow(max(0.0, h), exponent);
      vec3 baseColor = mix(bottomColor, topColor, h);

      vec3 pos = normalize(vPosition);

      // Wrap continuous progress into 0–4 range (progress may exceed 4.0
      // when the JS side accumulates past the 3→0 boundary)
      float p = mod(progress, 4.0);
      float partIndex = floor(p);
      float localT = fract(p);
      int current = int(partIndex);
      int prev = int(prevEffectIndex);

      // Evaluate effects for current (and possibly previous) part
      vec3 currentEffect = vec3(0.0);
      vec3 prevEffect = vec3(0.0);

      // Current effect
      if (current == 0) currentEffect = effectBlockyClouds(pos, time);
      else if (current == 1) currentEffect = effectStarfield(pos, time);
      else if (current == 2) currentEffect = effectLightning(pos, time);
      else currentEffect = effectAurora(pos, time);

      vec3 effect;

      if (localT < transitionInterval) {
        // In transition zone: blend with previous part
        if (prev == 0) prevEffect = effectBlockyClouds(pos, time);
        else if (prev == 1) prevEffect = effectStarfield(pos, time);
        else if (prev == 2) prevEffect = effectLightning(pos, time);
        else prevEffect = effectAurora(pos, time);

        float blend = smoothstep(0.0, transitionInterval, localT);
        effect = mix(prevEffect, currentEffect, blend);
      } else {
        effect = currentEffect;
      }

      // Apply effect additively onto base gradient
      vec3 color = baseColor + effect;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};
