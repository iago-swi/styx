/* ==========================================================================
   STYX // Multi-Pass WebGL2 HDR Bloom & Procedural Crystal Shader Renderer
   - Pass 1: Real-time FBM Nebula, Warped Flux Grid & 5 Procedural Crystal Artworks
   - Pass 2: High-DPI HDR Emissive Vector Layer (Styx Ribbons, Crawlers, Laser, FX)
   - Pass 3-4: Dual-Scale Separable Gaussian Bloom (Half-Res + Quarter-Res)
   - Pass 5: ACES Filmic Composite + Radial Shockwave Refraction + Optional CRT
   ========================================================================== */

(function (global) {
  'use strict';

  const STYX = (global.STYX = global.STYX || {});

  // Shared fullscreen quad vertex shader
  const QUAD_VS = `#version 300 es
  precision highp float;
  const vec2 POS[4] = vec2[](
    vec2(-1.0, -1.0),
    vec2( 1.0, -1.0),
    vec2(-1.0,  1.0),
    vec2( 1.0,  1.0)
  );
  out vec2 vUv;
  void main() {
    vec2 p = POS[gl_VertexID];
    vUv = p * 0.5 + 0.5;
    gl_Position = vec4(p, 0.0, 1.0);
  }`;

  // Pass 1: Playfield Void Nebula + Gravitational Flux Grid + 5 Crystal Shaders
  const SCENE_FS = `#version 300 es
  precision highp float;

  in vec2 vUv;
  out vec4 fragColor;

  uniform sampler2D uGridTex;
  uniform vec2 uResolution;
  uniform vec2 uGridSize;
  uniform float uTime;
  uniform int uPatternId;

  // Entity light/warp sources (normalized 0..1 playfield coords, y=0 top)
  uniform vec2 uPlayerPos;
  uniform float uPlayerDrawing;
  uniform vec2 uStyx0;
  uniform vec2 uStyx1;
  uniform float uStyx1Active;

  // Theme colors
  uniform vec3 uVoidDeep;
  uniform vec3 uVoidAccent;
  uniform vec3 uVoidGlow;
  uniform vec3 uGridColor;
  uniform vec3 uBorderColor;
  uniform vec3 uClaim1A;
  uniform vec3 uClaim1B;
  uniform vec3 uClaim5A;
  uniform vec3 uClaim5B;
  uniform vec3 uClaim10A;
  uniform vec3 uClaim10B;

  // Fast 2D hash & noise
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = rot * p * 2.04 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  // Hexagonal distance for Pattern 0
  vec3 hexGrid(vec2 p) {
    const vec2 s = vec2(1.0, 1.7320508);
    vec4 hC = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
    vec4 h = vec4(p - hC.xy * s, p - (hC.zw + 0.5) * s);
    vec2 r = (dot(h.xy, h.xy) < dot(h.zw, h.zw)) ? h.xy : h.zw;
    vec2 id = (dot(h.xy, h.xy) < dot(h.zw, h.zw)) ? hC.xy : hC.zw;
    float d = max(dot(abs(r), s * 0.5), abs(r.x));
    return vec3(0.5 - d, hash21(id), length(r));
  }

  // Voronoi stained-glass for Pattern 1
  vec2 voronoi(vec2 x) {
    vec2 n = floor(x);
    vec2 f = fract(x);
    float md = 8.0;
    float id = 0.0;
    float md2 = 8.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = hash22(n + g);
        o = 0.5 + 0.42 * sin(uTime * 0.45 + 6.2831 * o);
        vec2 r = g + o - f;
        float d = dot(r, r);
        if (d < md) {
          md2 = md;
          md = d;
          id = hash21(n + g);
        } else if (d < md2) {
          md2 = d;
        }
      }
    }
    return vec2(sqrt(md2) - sqrt(md), id);
  }

  // Procedural crystalline stained-glass artwork inside claimed territory
  vec3 sampleCrystalArt(vec2 uv, vec3 colA, vec3 colB, float t) {
    vec2 aspect = vec2(1.6, 1.0);
    vec2 p = (uv - 0.5) * aspect;
    float sheen = pow(max(0.0, sin((uv.x * 1.4 - uv.y * 0.9) * 3.8 - t * 0.85)), 6.0);
    float radial = length(p);

    if (uPatternId == 0) {
      // 0: Hexagonal Prism Honeycomb
      vec3 hx = hexGrid(p * 13.5);
      float edge = smoothstep(0.06, 0.008, hx.x);
      float facet = 0.35 + 0.65 * hx.y;
      float pulse = 0.5 + 0.5 * sin(t * 1.6 + hx.y * 6.28 - radial * 5.0);
      vec3 base = mix(colA, colB, facet * 0.52 + pulse * 0.22);
      base += colB * edge * (0.85 + 0.4 * pulse);
      base += vec3(1.0) * sheen * 0.24;
      return base;
    } else if (uPatternId == 1) {
      // 1: Voronoi Cathedral Stained Glass
      vec2 v = voronoi(p * 10.5);
      float edge = smoothstep(0.085, 0.012, v.x);
      float glow = 0.5 + 0.5 * sin(t * 1.3 + v.y * 9.0);
      vec3 base = mix(colA, colB, 0.28 + 0.55 * v.y);
      base *= (0.72 + 0.35 * glow);
      base += mix(colB, vec3(1.0), 0.45) * edge * 0.95;
      base += vec3(1.0) * sheen * 0.28;
      return base;
    } else if (uPatternId == 2) {
      // 2: Sacred Geometric Circuit Mandala
      float ang = atan(p.y, p.x);
      float rings = abs(fract(radial * 9.0 - t * 0.18) - 0.5);
      float spokes = abs(fract(ang / 6.283185 * 16.0) - 0.5);
      float lineR = smoothstep(0.06, 0.01, rings);
      float lineS = smoothstep(0.05, 0.01, spokes) * smoothstep(0.06, 0.25, radial);
      float gridL = max(
        smoothstep(0.05, 0.01, abs(fract(p.x * 12.0) - 0.5)),
        smoothstep(0.05, 0.01, abs(fract(p.y * 12.0) - 0.5))
      ) * 0.35;
      float pattern = max(max(lineR, lineS), gridL);
      float wave = 0.5 + 0.5 * sin(radial * 16.0 - t * 2.2);
      vec3 base = mix(colA, colB, 0.22 + 0.35 * wave);
      base += mix(colB, vec3(1.0), 0.35) * pattern * (0.75 + 0.35 * wave);
      base += vec3(1.0) * sheen * 0.24;
      return base;
    } else if (uPatternId == 3) {
      // 3: Molten Crystalline Topographic Contours
      float n = fbm(p * 5.2 + vec2(t * 0.08, -t * 0.06));
      float contour = abs(fract(n * 8.0) - 0.5);
      float ridge = smoothstep(0.08, 0.012, contour);
      vec3 base = mix(colA, colB, smoothstep(0.25, 0.85, n));
      base += mix(colB, vec3(1.0, 0.96, 0.85), 0.4) * ridge * 0.9;
      base += vec3(1.0) * sheen * 0.22;
      return base;
    } else {
      // 4: Prismatic Supernova Interference Lattice
      vec2 q = p * 11.0;
      float w1 = sin(q.x + t * 0.7) * cos(q.y - t * 0.6);
      float w2 = sin((q.x + q.y) * 0.707 + t * 0.9);
      float w3 = cos(radial * 18.0 - t * 1.8);
      float inter = (w1 + w2 + w3) * 0.333;
      float lattice = smoothstep(0.11, 0.015, abs(inter));
      vec3 rainbow = 0.5 + 0.5 * cos(6.2831 * (inter * 0.5 + radial * 0.6 - t * 0.1 + vec3(0.0, 0.33, 0.67)));
      vec3 base = mix(colA, colB, 0.4 + 0.35 * inter);
      base = mix(base, base * 0.65 + rainbow * 0.55, 0.45);
      base += mix(colB, vec3(1.0), 0.5) * lattice * 0.95;
      base += vec3(1.0) * sheen * 0.28;
      return base;
    }
  }

  void main() {
    // Flip Y so uv.y = 0 at top, matching logical grid
    vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
    vec4 gNearest = texture(uGridTex, uv);

    // Smooth anti-aliased edge sampling via small tap neighborhood
    vec2 texel = 1.0 / uGridSize;
    float flash = gNearest.b;
    float seam = gNearest.g;
    float borderGlow = gNearest.a;

    // Smooth border halo across adjacent texels for silky glow
    float haloSmooth = (
      texture(uGridTex, uv).a * 0.40 +
      texture(uGridTex, uv + vec2(texel.x, 0.0)).a * 0.15 +
      texture(uGridTex, uv - vec2(texel.x, 0.0)).a * 0.15 +
      texture(uGridTex, uv + vec2(0.0, texel.y)).a * 0.15 +
      texture(uGridTex, uv - vec2(0.0, texel.y)).a * 0.15
    );

    float cellR = gNearest.r;
    bool isEmpty = cellR < 0.12;
    bool isBorder = cellR >= 0.12 && cellR < 0.38;

    vec3 color = vec3(0.0);

    if (isEmpty) {
      // === LIVING ABYSSAL VOID WITH GRAVITATIONAL FLUX WARP ===
      vec2 aspect = vec2(1.6, 1.0);
      vec2 dStyx0 = (uv - uStyx0) * aspect;
      float dist0 = length(dStyx0);
      vec2 warp = -dStyx0 * (0.042 / (dist0 * dist0 + 0.032));

      float styxAura = exp(-dist0 * 5.2) * 0.55;

      if (uStyx1Active > 0.5) {
        vec2 dStyx1 = (uv - uStyx1) * aspect;
        float dist1 = length(dStyx1);
        warp += -dStyx1 * (0.036 / (dist1 * dist1 + 0.032));
        styxAura += exp(-dist1 * 5.6) * 0.45;
      }

      vec2 dPlayer = (uv - uPlayerPos) * aspect;
      float distP = length(dPlayer);
      warp += -dPlayer * (0.015 * (0.4 + 0.8 * uPlayerDrawing) / (distP * distP + 0.025));
      float playerAura = exp(-distP * 8.5) * (0.28 + 0.38 * uPlayerDrawing);

      vec2 wuv = uv + warp;

      // 2-layer domain-warped FBM nebula
      vec2 np = wuv * vec2(4.2, 2.7);
      float n1 = fbm(np + vec2(uTime * 0.06, -uTime * 0.04));
      float n2 = fbm(np * 1.85 + vec2(n1 * 2.1, -uTime * 0.09));
      float nebula = smoothstep(0.24, 0.84, n2);

      color = mix(uVoidDeep, uVoidAccent, nebula * 0.92);
      color += uVoidGlow * pow(nebula, 3.0) * 0.42;

      // Warped magnetic flux coordinate grid
      vec2 gp = wuv * vec2(32.0, 20.0);
      vec2 gridFract = abs(fract(gp - 0.5) - 0.5);
      float lineX = smoothstep(0.055, 0.008, gridFract.x);
      float lineY = smoothstep(0.055, 0.008, gridFract.y);
      float gridMask = max(lineX, lineY);

      // Grid illuminates dramatically near the Styx and player!
      float gridBoost = 0.14 + styxAura * 1.15 + playerAura * 1.1;
      color += uGridColor * gridMask * gridBoost;

      // Subtle starfield glints
      vec2 starCell = floor(uv * vec2(120.0, 75.0));
      float sh = hash21(starCell);
      if (sh > 0.985) {
        vec2 sc = fract(uv * vec2(120.0, 75.0)) - 0.5;
        float twinkle = 0.55 + 0.45 * sin(uTime * 3.5 + sh * 90.0);
        float star = smoothstep(0.28, 0.0, length(sc)) * twinkle;
        color += mix(uVoidGlow, vec3(1.0), 0.65) * star * 0.65;
      }

      // Soft energy aura from Styx & Player
      color += uVoidGlow * styxAura * 0.38;
      color += uBorderColor * playerAura * 0.22;

      // Soft inner neon wall bleed into the void
      color += uBorderColor * pow(haloSmooth, 1.8) * 0.52;
    } else {
      // === CLAIMED CRYSTAL TERRITORY OR ACTIVE BORDER ===
      vec3 cA = uClaim1A;
      vec3 cB = uClaim1B;
      if (cellR > 0.88) {
        cA = uClaim10A;
        cB = uClaim10B;
      } else if (cellR > 0.62) {
        cA = uClaim5A;
        cB = uClaim5B;
      }

      color = sampleCrystalArt(uv, cA, cB, uTime);

      // Luminous stained-glass internal seams (preserved cut history)
      if (seam > 0.1) {
        vec3 seamTint = uClaim1B;
        if (seam > 0.85) seamTint = uClaim10B;
        else if (seam > 0.5) seamTint = uClaim5B;
        color += mix(seamTint, vec3(1.0), 0.35) * 0.55;
      }

      // Active perimeter wall blazing neon bevel
      if (isBorder) {
        color = mix(color, uBorderColor, 0.72) + vec3(0.55, 0.82, 0.95);
      } else {
        color += uBorderColor * pow(haloSmooth, 2.2) * 0.68;
      }

      // Expanding radial crystallization wave flash!
      if (flash > 0.01) {
        float f = flash;
        color += mix(cB, vec3(1.0), 0.65) * (f * 1.45);
      }
    }

    // Subtle crisp border glow bump on active wall core
    if (borderGlow > 0.9) {
      color += uBorderColor * 0.35;
    }

    fragColor = vec4(color, 1.0);
  }`;

  // Pass 2: Bright-pass extract combining Scene HDR + Entity Emissive Layer
  const EXTRACT_FS = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 fragColor;

  uniform sampler2D uSceneTex;
  uniform sampler2D uEntityTex;

  void main() {
    vec3 scene = texture(uSceneTex, vUv).rgb;
    vec4 ent = texture(uEntityTex, vUv);

    // Extract highlights from scene (borders, crystal flashes, seams)
    float lum = max(scene.r, max(scene.g, scene.b));
    float soft = clamp((lum - 0.52) / 0.65, 0.0, 2.0);
    vec3 brightScene = scene * soft * 0.85;

    // Entities are intrinsically emissive HDR light sources
    vec3 brightEnt = ent.rgb * (1.25 + ent.a * 0.55);

    fragColor = vec4(brightScene + brightEnt, 1.0);
  }`;

  // Pass 3 & 4: High-quality 9-tap Separable Gaussian Blur
  const BLUR_FS = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 fragColor;

  uniform sampler2D uTex;
  uniform vec2 uDir; // (1/w, 0) or (0, 1/h)

  void main() {
    vec3 sum = texture(uTex, vUv).rgb * 0.227027;
    sum += texture(uTex, vUv + uDir * 1.384615).rgb * 0.316216;
    sum += texture(uTex, vUv - uDir * 1.384615).rgb * 0.316216;
    sum += texture(uTex, vUv + uDir * 3.230769).rgb * 0.070270;
    sum += texture(uTex, vUv - uDir * 3.230769).rgb * 0.070270;
    fragColor = vec4(sum, 1.0);
  }`;

  // Pass 5: Final ACES Filmic Composite + Radial Shockwave + Chromatic Aberration + CRT
  const COMPOSITE_FS = `#version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 fragColor;

  uniform sampler2D uSceneTex;
  uniform sampler2D uEntityTex;
  uniform sampler2D uBloomTight;
  uniform sampler2D uBloomWide;

  uniform vec2 uResolution;
  uniform float uTime;
  uniform vec2 uShakeOffset;

  uniform vec2 uShockCenter;
  uniform float uShockTime;
  uniform float uShockStrength;
  uniform float uCrtEnabled;

  // ACES Filmic Tone Mapping for pearlescent HDR neon highlights
  vec3 aces(vec3 x) {
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  void main() {
    vec2 uv = vUv + uShakeOffset;

    // Optional radial shockwave refraction & chromatic dispersion
    vec2 chromaOff = vec2(0.0);
    if (uShockStrength > 0.001 && uShockTime > 0.0) {
      vec2 center = vec2(uShockCenter.x, 1.0 - uShockCenter.y);
      vec2 aspect = vec2(1.6, 1.0);
      vec2 diff = (uv - center) * aspect;
      float dist = length(diff);
      float radius = uShockTime * 1.15;
      float ring = exp(-pow((dist - radius) * 14.0, 2.0)) * (1.0 - smoothstep(0.2, 1.25, uShockTime));
      vec2 dir = normalize(diff + 0.0001) / aspect;
      uv += dir * ring * 0.018 * uShockStrength;
      chromaOff = dir * ring * 0.009 * uShockStrength;
    }

    vec3 scene;
    if (length(chromaOff) > 0.0002) {
      scene.r = texture(uSceneTex, uv + chromaOff).r;
      scene.g = texture(uSceneTex, uv).g;
      scene.b = texture(uSceneTex, uv - chromaOff).b;
    } else {
      scene = texture(uSceneTex, uv).rgb;
    }

    vec4 ent = texture(uEntityTex, uv);
    vec3 tight = texture(uBloomTight, uv).rgb;
    vec3 wide = texture(uBloomWide, uv).rgb;

    // Blend crisp emissive entities over scene + dual-scale HDR bloom
    vec3 col = mix(scene, scene + ent.rgb * 1.18, clamp(ent.a * 1.1, 0.0, 1.0));
    col += ent.rgb * 0.35;
    col += tight * 0.72 + wide * 0.58;

    // Optional 1983 CRT Scanlines & Phosphor Glow
    if (uCrtEnabled > 0.5) {
      float scan = 0.90 + 0.10 * sin(gl_FragCoord.y * 3.14159 * 1.0);
      float triad = 0.96 + 0.04 * sin(gl_FragCoord.x * 2.0);
      col *= scan * triad;
    }

    // Subtle cinematic edge vignette
    vec2 vig = vUv * (1.0 - vUv.yx);
    float vigFactor = pow(clamp(vig.x * vig.y * 18.0, 0.0, 1.0), 0.16);
    col *= mix(0.76, 1.0, vigFactor);

    // ACES Filmic tone mapping + gamma crispness
    col = aces(col * 1.08);
    fragColor = vec4(col, 1.0);
  }`;

  // --------------------------------------------------------------------------
  // RENDERER CLASS
  // --------------------------------------------------------------------------
  class StyxRenderer {
    constructor(glCanvas, uiCanvas, gridW = 320, gridH = 200) {
      this.glCanvas = glCanvas;
      this.uiCanvas = uiCanvas;
      this.uiCtx = uiCanvas.getContext('2d');
      this.gridW = gridW;
      this.gridH = gridH;

      // Offscreen high-DPI canvas for razor-sharp HDR vector entities
      this.entityCanvas = document.createElement('canvas');
      this.entityCtx = this.entityCanvas.getContext('2d');

      this.crtEnabled = false;
      this.time = 0;
      this.width = 960;
      this.height = 600;

      this.gl = glCanvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance'
      });

      this.useWebGL = !!this.gl;
      if (this.useWebGL) {
        try {
          this._initWebGL();
        } catch (err) {
          console.warn('WebGL2 init fallback to 2D:', err);
          this.useWebGL = false;
        }
      }

      if (!this.useWebGL) {
        this.fallbackCtx = glCanvas.getContext('2d');
      }
    }

    _compileShader(type, src) {
      const gl = this.gl;
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(sh);
        gl.deleteShader(sh);
        throw new Error('Shader compile error: ' + info);
      }
      return sh;
    }

    _createProgram(vsSrc, fsSrc) {
      const gl = this.gl;
      const vs = this._compileShader(gl.VERTEX_SHADER, vsSrc);
      const fs = this._compileShader(gl.FRAGMENT_SHADER, fsSrc);
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error('Program link error: ' + gl.getProgramInfoLog(prog));
      }
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return prog;
    }

    _createFBO(w, h) {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { fbo, tex, w, h };
    }

    _initWebGL() {
      const gl = this.gl;
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);

      // Compile programs
      this.progScene = this._createProgram(QUAD_VS, SCENE_FS);
      this.progExtract = this._createProgram(QUAD_VS, EXTRACT_FS);
      this.progBlur = this._createProgram(QUAD_VS, BLUR_FS);
      this.progComposite = this._createProgram(QUAD_VS, COMPOSITE_FS);

      // Cache uniform locations
      this.uScene = this._getUniforms(this.progScene, [
        'uGridTex', 'uResolution', 'uGridSize', 'uTime', 'uPatternId',
        'uPlayerPos', 'uPlayerDrawing', 'uStyx0', 'uStyx1', 'uStyx1Active',
        'uVoidDeep', 'uVoidAccent', 'uVoidGlow', 'uGridColor', 'uBorderColor',
        'uClaim1A', 'uClaim1B', 'uClaim5A', 'uClaim5B', 'uClaim10A', 'uClaim10B'
      ]);
      this.uExtract = this._getUniforms(this.progExtract, ['uSceneTex', 'uEntityTex']);
      this.uBlur = this._getUniforms(this.progBlur, ['uTex', 'uDir']);
      this.uComposite = this._getUniforms(this.progComposite, [
        'uSceneTex', 'uEntityTex', 'uBloomTight', 'uBloomWide',
        'uResolution', 'uTime', 'uShakeOffset',
        'uShockCenter', 'uShockTime', 'uShockStrength', 'uCrtEnabled'
      ]);

      // Grid state texture (320x200 RGBA8, nearest for crisp cell boundaries)
      this.gridTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.gridTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, this.gridW, this.gridH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

      // Entity emissive canvas texture
      this.entityTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.entityTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      this._allocateFBOs(960, 600);
    }

    _getUniforms(prog, names) {
      const gl = this.gl;
      const out = {};
      for (const n of names) out[n] = gl.getUniformLocation(prog, n);
      return out;
    }

    _deleteFBO(target) {
      if (!target || !this.gl) return;
      this.gl.deleteFramebuffer(target.fbo);
      this.gl.deleteTexture(target.tex);
    }

    _allocateFBOs(w, h) {
      this._deleteFBO(this.fboScene);
      this._deleteFBO(this.fboHalfA);
      this._deleteFBO(this.fboHalfB);
      this._deleteFBO(this.fboQuarterA);
      this._deleteFBO(this.fboQuarterB);

      const hw = Math.max(160, w >> 1);
      const hh = Math.max(100, h >> 1);
      const qw = Math.max(80, w >> 2);
      const qh = Math.max(50, h >> 2);

      this.fboScene = this._createFBO(w, h);
      this.fboHalfA = this._createFBO(hw, hh);
      this.fboHalfB = this._createFBO(hw, hh);
      this.fboQuarterA = this._createFBO(qw, qh);
      this.fboQuarterB = this._createFBO(qw, qh);
    }

    resize(cssWidth, cssHeight) {
      const dpr = Math.min(global.devicePixelRatio || 1, 1.75);
      const w = Math.max(320, Math.round(cssWidth * dpr));
      const h = Math.max(200, Math.round(cssHeight * dpr));
      if (w === this.width && h === this.height) return;

      this.width = w;
      this.height = h;
      this.glCanvas.width = w;
      this.glCanvas.height = h;
      this.uiCanvas.width = w;
      this.uiCanvas.height = h;
      this.entityCanvas.width = w;
      this.entityCanvas.height = h;

      if (this.useWebGL) {
        this._allocateFBOs(w, h);
      }
    }

    render(dt, state) {
      this.time += dt;
      const { grid, player, styxList, caterpillars, fx, theme, multiplier, demoMode } = state;

      // 1. Render all dynamic glowing entities onto offscreen HDR Canvas2D
      this._drawEntityLayer(player, styxList, caterpillars, fx, theme, multiplier, demoMode);

      if (this.useWebGL) {
        this._renderWebGL(grid, player, styxList, fx, theme);
      } else {
        this._renderFallback2D(grid, theme);
      }

      // 2. Render crisp typography / floating score callouts above bloom
      this._drawUIOverlay(fx);
    }

    // ------------------------------------------------------------------------
    // HDR EMISSIVE VECTOR LAYER (Styx Ribbons, Caterpillars, Trail, Player, FX)
    // ------------------------------------------------------------------------
    _drawEntityLayer(player, styxList, caterpillars, fx, theme, multiplier, demoMode) {
      const ctx = this.entityCtx;
      const W = this.width;
      const H = this.height;
      const sx = W / this.gridW;
      const sy = H / this.gridH;
      const scale = (sx + sy) * 0.5;

      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // 1. Ambient Void Motes
      for (let i = 0; i < fx.motes.length; i++) {
        const m = fx.motes[i];
        const mx = m.x * sx;
        const my = m.y * sy;
        const alpha = 0.22 + 0.28 * Math.sin(m.phase);
        ctx.fillStyle = `rgba(130, 235, 255, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(mx, my, m.size * scale * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Expanding Shockwave Neon Rings
      for (let i = 0; i < fx.rings.length; i++) {
        const r = fx.rings[i];
        const a = Math.max(0, r.life / r.maxLife);
        ctx.strokeStyle = r.color;
        ctx.globalAlpha = a * 0.85;
        ctx.lineWidth = (1.6 + a * 2.8) * scale * 0.55;
        ctx.beginPath();
        ctx.arc(r.x * sx, r.y * sy, r.r * scale, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // 3. THE STYX CREATURE(S) — Iridescent Swirling Multi-Ribbon Plasma Art
      for (let s = 0; s < styxList.length; s++) {
        this._drawStyxCreature(ctx, styxList[s], sx, sy, scale, theme);
      }

      // 4. Active Player Plasma Tether & Sizzling Fuse
      if (!demoMode && player && player.trail.length > 1) {
        this._drawPlayerTrail(ctx, player, sx, sy, scale, theme, multiplier);
      }

      // 5. Edge-Crawling Cyber-Caterpillars
      for (let c = 0; c < caterpillars.length; c++) {
        if (caterpillars[c].alive) {
          this._drawCaterpillar(ctx, caterpillars[c], sx, sy, scale, theme);
        }
      }

      // 6. Player Crystalline Diamond Core
      if (!demoMode && player && player.alive) {
        this._drawPlayer(ctx, player, sx, sy, scale, theme, multiplier);
      }

      // 7. Additive Particles (Laser Sparks + Tumbling Crystal Shards)
      for (let i = 0; i < fx.particles.length; i++) {
        const p = fx.particles[i];
        const ratio = Math.max(0, p.life / p.maxLife);
        const px = p.x * sx;
        const py = p.y * sy;
        ctx.globalAlpha = ratio;

        if (p.kind === 'spark') {
          const tailX = px - p.vx * 0.032 * sx;
          const tailY = py - p.vy * 0.032 * sy;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * scale * 0.45 * ratio;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(px, py);
          ctx.stroke();
        } else {
          // Spinning glowing crystal diamond shard
          const sz = p.size * scale * 0.6 * (0.4 + 0.6 * ratio);
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(0, -sz);
          ctx.lineTo(sz * 0.65, 0);
          ctx.lineTo(0, sz);
          ctx.lineTo(-sz * 0.65, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      ctx.restore();
    }

    _drawStyxCreature(ctx, styx, sx, sy, scale, theme) {
      const hist = styx.history;
      const pal = theme.styxPalette;
      const count = hist.length;
      if (count < 2) return;

      // Soft volumetric radial plasma aura around the core
      const coreX = styx.cx * sx;
      const coreY = styx.cy * sy;
      const auraR = (styx.compact ? 26 : 36) * scale;
      const grad = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, auraR);
      grad.addColorStop(0, styx.agitation > 0.35 ? 'rgba(255, 110, 175, 0.42)' : 'rgba(120, 210, 255, 0.34)');
      grad.addColorStop(0.45, 'rgba(180, 60, 255, 0.14)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(coreX, coreY, auraR, 0, Math.PI * 2);
      ctx.fill();

      // Delicate silk-filament longitudinal energy threads linking history frames
      for (let v = 0; v < 4; v++) {
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const pt = hist[i].pts[v];
          if (i === 0) ctx.moveTo(pt.x * sx, pt.y * sy);
          else ctx.lineTo(pt.x * sx, pt.y * sy);
        }
        ctx.strokeStyle = pal[v % (pal.length - 1)];
        ctx.globalAlpha = 0.24;
        ctx.lineWidth = scale * 0.45;
        ctx.stroke();
      }

      // Draw each swirling iridescent ribbon slice from oldest (back) to newest (front)
      for (let i = count - 1; i >= 0; i--) {
        const frame = hist[i];
        const age = i / count; // 0 = newest, 1 = oldest
        const alpha = Math.pow(1 - age, 1.35) * (i === 0 ? 1.0 : 0.68);
        const colorIdx = Math.floor((age * (pal.length - 1) + this.time * 0.85) % (pal.length - 1));
        const col = i === 0 ? '#ffffff' : pal[colorIdx];

        const pts = frame.pts;
        ctx.beginPath();
        // Smooth closed midpoint quadratic spline through the 4 writhing nodes
        const m30x = (pts[3].x + pts[0].x) * 0.5 * sx;
        const m30y = (pts[3].y + pts[0].y) * 0.5 * sy;
        ctx.moveTo(m30x, m30y);
        for (let k = 0; k < 4; k++) {
          const cur = pts[k];
          const nxt = pts[(k + 1) & 3];
          const mx = (cur.x + nxt.x) * 0.5 * sx;
          const my = (cur.y + nxt.y) * 0.5 * sy;
          ctx.quadraticCurveTo(cur.x * sx, cur.y * sy, mx, my);
        }
        ctx.closePath();

        ctx.strokeStyle = col;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = (i === 0 ? 2.2 : 0.9 + (1 - age) * 1.1) * scale * 0.55;
        ctx.stroke();

        // Cross-prism crystalline diagonals on leading slices for iconic retro-futuristic Styx vibe
        if (i < 5) {
          ctx.beginPath();
          ctx.moveTo(pts[0].x * sx, pts[0].y * sy);
          ctx.lineTo(pts[2].x * sx, pts[2].y * sy);
          ctx.moveTo(pts[1].x * sx, pts[1].y * sy);
          ctx.lineTo(pts[3].x * sx, pts[3].y * sy);
          ctx.strokeStyle = pal[(i + 2) % (pal.length - 1)];
          ctx.globalAlpha = alpha * 0.42;
          ctx.lineWidth = scale * 0.35;
          ctx.stroke();
        }
      }

      // Glowing energy nodes on leading ribbon
      ctx.globalAlpha = 1;
      for (let k = 0; k < styx.nodes.length; k++) {
        const n = styx.nodes[k];
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(n.x * sx, n.y * sy, scale * 0.72, 0, Math.PI * 2);
        ctx.fill();
      }

      // Crackling electric arcs jumping across the creature
      for (let i = 0; i < styx.arcs.length; i++) {
        const arc = styx.arcs[i];
        ctx.strokeStyle = styx.agitation > 0.35 ? '#ff99cc' : '#c8f8ff';
        ctx.globalAlpha = Math.min(1, arc.life * 10);
        ctx.lineWidth = scale * 0.45;
        ctx.beginPath();
        ctx.moveTo(arc.x1 * sx, arc.y1 * sy);
        const mx = (arc.x1 + arc.x2) * 0.5 + (Math.random() - 0.5) * 6;
        const my = (arc.y1 + arc.y2) * 0.5 + (Math.random() - 0.5) * 6;
        ctx.lineTo(mx * sx, my * sy);
        ctx.lineTo(arc.x2 * sx, arc.y2 * sy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    _drawPlayerTrail(ctx, player, sx, sy, scale, theme, multiplier) {
      const trail = player.trail;
      const fuseIdx = player.fuseActive ? Math.min(trail.length - 1, Math.floor(player.fuseProgress)) : 0;
      const trailCol = multiplier === 10 ? '#ffd24c' : multiplier === 5 ? '#ff4bd8' : theme.trailColor;

      // Burned portion behind fuse (smoldering ember red)
      if (player.fuseActive && fuseIdx > 1) {
        ctx.beginPath();
        ctx.moveTo(trail[0].x * sx, trail[0].y * sy);
        for (let i = 1; i <= fuseIdx; i++) {
          ctx.lineTo(trail[i].x * sx, trail[i].y * sy);
        }
        ctx.strokeStyle = '#ff3344';
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = scale * 1.1;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Live active laser filament (from fuse tip to player)
      ctx.beginPath();
      ctx.moveTo(trail[fuseIdx].x * sx, trail[fuseIdx].y * sy);
      for (let i = fuseIdx + 1; i < trail.length; i++) {
        ctx.lineTo(trail[i].x * sx, trail[i].y * sy);
      }

      // Wide plasma halo
      ctx.strokeStyle = trailCol;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = scale * 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();

      // Vibrant core laser
      ctx.globalAlpha = 0.92;
      ctx.lineWidth = scale * 1.1;
      ctx.stroke();

      // White-hot inner filament
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = scale * 0.45;
      ctx.stroke();

      // Origin anchor diamond flare
      const orig = trail[0];
      ctx.fillStyle = trailCol;
      ctx.beginPath();
      ctx.arc(orig.x * sx, orig.y * sy, scale * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // Sizzling Fuse Starburst
      if (player.fuseActive) {
        const fp = trail[fuseIdx];
        const fx = fp.x * sx;
        const fy = fp.y * sy;
        const rOuter = scale * (2.6 + Math.sin(this.time * 42) * 0.8);
        ctx.fillStyle = '#ffcc33';
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + this.time * 12;
          const r = (k % 2 === 0) ? rOuter : rOuter * 0.35;
          const px = fx + Math.cos(a) * r;
          const py = fy + Math.sin(a) * r;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(fx, fy, scale * 1.0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    _drawCaterpillar(ctx, cat, sx, sy, scale, theme) {
      const segs = cat.getSegments();
      const bodyPal = theme.caterpillarBody;

      // Glowing articulated segments from tail to head
      for (let i = segs.length - 1; i >= 0; i--) {
        const p = segs[i];
        const t = i / Math.max(1, segs.length - 1);
        const pulse = 0.82 + 0.25 * Math.sin(cat.wigglePhase - i * 0.65);
        const rad = (i === 0 ? 1.85 : (1.42 - t * 0.65)) * scale * pulse;
        const col = i === 0 ? theme.caterpillarHead : bodyPal[i % bodyPal.length];
        const px = p.x * sx;
        const py = p.y * sy;

        // Subtle energy legs fanning off body segments
        if (i > 0 && i < segs.length - 1) {
          const prev = segs[i - 1];
          const dx = prev.x - p.x;
          const dy = prev.y - p.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;
          const legSwing = Math.sin(cat.wigglePhase * 1.5 - i * 1.1) * 0.55;
          const legLen = rad * 1.65;
          ctx.strokeStyle = col;
          ctx.globalAlpha = 0.55;
          ctx.lineWidth = scale * 0.32;
          ctx.beginPath();
          ctx.moveTo(px + (nx + (dx / len) * legSwing) * legLen, py + (ny + (dy / len) * legSwing) * legLen);
          ctx.lineTo(px - (nx - (dx / len) * legSwing) * legLen, py - (ny - (dy / len) * legSwing) * legLen);
          ctx.stroke();
        }

        // Segment outer plasma glow
        ctx.globalAlpha = i === 0 ? 0.95 : 0.78;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, Math.PI * 2);
        ctx.fill();

        // Bright core bead
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = i === 0 ? 0.95 : 0.45 * pulse;
        ctx.beginPath();
        ctx.arc(px, py, rad * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }

      // Armored head mandibles / glowing antennae
      if (segs.length >= 2) {
        const h = segs[0];
        const n = segs[1];
        const ang = Math.atan2(h.y - n.y, h.x - n.x);
        const hx = h.x * sx;
        const hy = h.y * sy;
        const antLen = scale * 2.8;
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = scale * 0.4;
        for (const side of [-0.55, 0.55]) {
          const a = ang + side + Math.sin(cat.wigglePhase * 2) * 0.14;
          ctx.beginPath();
          ctx.moveTo(hx, hy);
          ctx.lineTo(hx + Math.cos(a) * antLen, hy + Math.sin(a) * antLen);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    _drawPlayer(ctx, player, sx, sy, scale, theme, multiplier) {
      const px = player.vx * sx;
      const py = player.vy * sy;
      const coreCol = multiplier === 10 ? '#ffdd55' : multiplier === 5 ? '#ff66e0' : theme.playerColor;

      // Soft energy halo
      const haloR = scale * (player.state === 'DRAWING' ? 5.6 : 4.2);
      const grad = ctx.createRadialGradient(px, py, 0, px, py, haloR);
      grad.addColorStop(0, 'rgba(255,255,255,0.85)');
      grad.addColorStop(0.35, coreCol);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.arc(px, py, haloR, 0, Math.PI * 2);
      ctx.fill();

      // Orbiting geometric ring
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(player.orbitAngle);
      ctx.strokeStyle = coreCol;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = scale * 0.45;
      const ringR = scale * (player.state === 'DRAWING' ? 2.55 : 2.15);
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 1.45);
      ctx.stroke();

      // Inner crystalline diamond
      ctx.rotate(-player.orbitAngle * 1.8);
      const d = scale * 1.55;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 1.0;
      ctx.beginPath();
      ctx.moveTo(0, -d);
      ctx.lineTo(d * 0.85, 0);
      ctx.lineTo(0, d);
      ctx.lineTo(-d * 0.85, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Invulnerability respawn shield (pulsing hex bubble)
      if (player.shieldTimer > 0) {
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 22);
        ctx.strokeStyle = '#66ffff';
        ctx.globalAlpha = Math.min(0.9, player.shieldTimer * 0.8) * (0.55 + 0.45 * pulse);
        ctx.lineWidth = scale * 0.5;
        const sr = scale * 4.4;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + this.time * 2.2;
          const x = px + Math.cos(a) * sr;
          const y = py + Math.sin(a) * sr;
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // ------------------------------------------------------------------------
    // MULTI-PASS WEBGL2 PIPELINE
    // ------------------------------------------------------------------------
    _renderWebGL(grid, player, styxList, fx, theme) {
      const gl = this.gl;
      gl.bindVertexArray(this.vao);

      // Upload grid state texture only when changed
      if (grid.dirtyTexture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.gridTex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.gridW, this.gridH, gl.RGBA, gl.UNSIGNED_BYTE, grid.texData);
        grid.dirtyTexture = false;
      }

      // Upload offscreen HDR entity canvas texture
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.entityTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.entityCanvas);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

      // --- PASS 1: Scene Shader -> fboScene ---
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboScene.fbo);
      gl.viewport(0, 0, this.fboScene.w, this.fboScene.h);
      gl.useProgram(this.progScene);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.gridTex);
      gl.uniform1i(this.uScene.uGridTex, 0);
      gl.uniform2f(this.uScene.uResolution, this.width, this.height);
      gl.uniform2f(this.uScene.uGridSize, this.gridW, this.gridH);
      gl.uniform1f(this.uScene.uTime, this.time);
      gl.uniform1i(this.uScene.uPatternId, theme.patternId);

      const px = player ? player.vx / this.gridW : 0.5;
      const py = player ? player.vy / this.gridH : 0.98;
      gl.uniform2f(this.uScene.uPlayerPos, px, py);
      gl.uniform1f(this.uScene.uPlayerDrawing, (player && player.state === 'DRAWING') ? 1.0 : 0.0);

      const s0 = styxList[0];
      const s1 = styxList[1];
      gl.uniform2f(this.uScene.uStyx0, s0 ? s0.cx / this.gridW : 0.5, s0 ? s0.cy / this.gridH : 0.5);
      gl.uniform2f(this.uScene.uStyx1, s1 ? s1.cx / this.gridW : 0.5, s1 ? s1.cy / this.gridH : 0.5);
      gl.uniform1f(this.uScene.uStyx1Active, s1 ? 1.0 : 0.0);

      gl.uniform3fv(this.uScene.uVoidDeep, theme.voidDeep);
      gl.uniform3fv(this.uScene.uVoidAccent, theme.voidAccent);
      gl.uniform3fv(this.uScene.uVoidGlow, theme.voidGlow);
      gl.uniform3fv(this.uScene.uGridColor, theme.gridColor);
      gl.uniform3fv(this.uScene.uBorderColor, theme.borderColor);
      gl.uniform3fv(this.uScene.uClaim1A, theme.claim1A);
      gl.uniform3fv(this.uScene.uClaim1B, theme.claim1B);
      gl.uniform3fv(this.uScene.uClaim5A, theme.claim5A);
      gl.uniform3fv(this.uScene.uClaim5B, theme.claim5B);
      gl.uniform3fv(this.uScene.uClaim10A, theme.claim10A);
      gl.uniform3fv(this.uScene.uClaim10B, theme.claim10B);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // --- PASS 2: Extract Bright HDR Highlights -> fboHalfA ---
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboHalfA.fbo);
      gl.viewport(0, 0, this.fboHalfA.w, this.fboHalfA.h);
      gl.useProgram(this.progExtract);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.fboScene.tex);
      gl.uniform1i(this.uExtract.uSceneTex, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.entityTex);
      gl.uniform1i(this.uExtract.uEntityTex, 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // --- PASS 3: Tight Bloom (Half-Res Separable Gaussian H -> V) ---
      gl.useProgram(this.progBlur);
      gl.uniform1i(this.uBlur.uTex, 0);

      // H blur -> fboHalfB
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboHalfB.fbo);
      gl.viewport(0, 0, this.fboHalfB.w, this.fboHalfB.h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.fboHalfA.tex);
      gl.uniform2f(this.uBlur.uDir, 1.35 / this.fboHalfA.w, 0.0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // V blur -> fboHalfA (Tight bloom ready!)
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboHalfA.fbo);
      gl.viewport(0, 0, this.fboHalfA.w, this.fboHalfA.h);
      gl.bindTexture(gl.TEXTURE_2D, this.fboHalfB.tex);
      gl.uniform2f(this.uBlur.uDir, 0.0, 1.35 / this.fboHalfB.h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // --- PASS 4: Wide Atmospheric Bloom (Quarter-Res Separable Gaussian x2) ---
      // Downsample + H blur -> fboQuarterA
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboQuarterA.fbo);
      gl.viewport(0, 0, this.fboQuarterA.w, this.fboQuarterA.h);
      gl.bindTexture(gl.TEXTURE_2D, this.fboHalfA.tex);
      gl.uniform2f(this.uBlur.uDir, 2.2 / this.fboQuarterA.w, 0.0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // V blur -> fboQuarterB
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboQuarterB.fbo);
      gl.viewport(0, 0, this.fboQuarterB.w, this.fboQuarterB.h);
      gl.bindTexture(gl.TEXTURE_2D, this.fboQuarterA.tex);
      gl.uniform2f(this.uBlur.uDir, 0.0, 2.2 / this.fboQuarterB.h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Extra wide H+V pass for silky cinematic radiance
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboQuarterA.fbo);
      gl.bindTexture(gl.TEXTURE_2D, this.fboQuarterB.tex);
      gl.uniform2f(this.uBlur.uDir, 3.0 / this.fboQuarterA.w, 0.0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboQuarterB.fbo);
      gl.bindTexture(gl.TEXTURE_2D, this.fboQuarterA.tex);
      gl.uniform2f(this.uBlur.uDir, 0.0, 3.0 / this.fboQuarterB.h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // --- PASS 5: Final ACES Filmic Composite -> Screen ---
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.width, this.height);
      gl.useProgram(this.progComposite);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.fboScene.tex);
      gl.uniform1i(this.uComposite.uSceneTex, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.entityTex);
      gl.uniform1i(this.uComposite.uEntityTex, 1);

      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.fboHalfA.tex);
      gl.uniform1i(this.uComposite.uBloomTight, 2);

      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, this.fboQuarterB.tex);
      gl.uniform1i(this.uComposite.uBloomWide, 3);

      gl.uniform2f(this.uComposite.uResolution, this.width, this.height);
      gl.uniform1f(this.uComposite.uTime, this.time);

      const shakeX = fx.screenShake > 0.1 ? ((Math.random() - 0.5) * fx.screenShake * 2) / this.width : 0;
      const shakeY = fx.screenShake > 0.1 ? ((Math.random() - 0.5) * fx.screenShake * 2) / this.height : 0;
      gl.uniform2f(this.uComposite.uShakeOffset, shakeX, shakeY);

      gl.uniform2f(this.uComposite.uShockCenter, fx.shockwave.x, fx.shockwave.y);
      gl.uniform1f(this.uComposite.uShockTime, fx.shockwave.active ? fx.shockwave.time : 0);
      gl.uniform1f(this.uComposite.uShockStrength, fx.shockwave.active ? fx.shockwave.strength : 0);
      gl.uniform1f(this.uComposite.uCrtEnabled, this.crtEnabled ? 1.0 : 0.0);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // Graceful Canvas2D fallback if WebGL2 is unavailable
    _renderFallback2D(grid, theme) {
      const ctx = this.fallbackCtx;
      if (!ctx) return;
      const W = this.width;
      const H = this.height;
      ctx.fillStyle = '#050816';
      ctx.fillRect(0, 0, W, H);

      const sx = W / this.gridW;
      const sy = H / this.gridH;
      for (let y = 0; y < this.gridH; y++) {
        for (let x = 0; x < this.gridW; x++) {
          const c = grid.cells[y * this.gridW + x];
          if (c === STYX.CELL.BORDER) {
            ctx.fillStyle = '#2cf6ff';
            ctx.fillRect(x * sx, y * sy, sx + 0.5, sy + 0.5);
          } else if (c === STYX.CELL.CLAIMED_1) {
            ctx.fillStyle = 'rgba(20, 110, 200, 0.55)';
            ctx.fillRect(x * sx, y * sy, sx + 0.5, sy + 0.5);
          } else if (c === STYX.CELL.CLAIMED_5) {
            ctx.fillStyle = 'rgba(180, 40, 160, 0.55)';
            ctx.fillRect(x * sx, y * sy, sx + 0.5, sy + 0.5);
          } else if (c === STYX.CELL.CLAIMED_10) {
            ctx.fillStyle = 'rgba(220, 160, 30, 0.6)';
            ctx.fillRect(x * sx, y * sy, sx + 0.5, sy + 0.5);
          }
        }
      }
      ctx.drawImage(this.entityCanvas, 0, 0);
    }

    // Crisp Floating Holographic Callouts (rendered above post-processing)
    _drawUIOverlay(fx) {
      const ctx = this.uiCtx;
      const W = this.width;
      const H = this.height;
      const sx = W / this.gridW;
      const sy = H / this.gridH;
      const baseFont = Math.max(14, Math.round(W * 0.017));

      ctx.clearRect(0, 0, W, H);
      if (fx.texts.length === 0) return;

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < fx.texts.length; i++) {
        const t = fx.texts[i];
        const ratio = Math.max(0, t.life / t.maxLife);
        const alpha = ratio > 0.8 ? (1 - ratio) / 0.2 : Math.min(1, ratio * 1.6);
        const pop = ratio > 0.82 ? 0.85 + ((1 - ratio) / 0.18) * 0.25 : 1.0;
        const x = t.x * sx;
        const y = t.y * sy;

        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.font = `900 ${Math.round(baseFont * t.scale * pop)}px 'Cascadia Code', Consolas, monospace`;
        ctx.shadowColor = t.color;
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(t.text, x, y);

        if (t.subtext) {
          ctx.font = `700 ${Math.round(baseFont * 0.68 * t.scale)}px 'Cascadia Code', Consolas, monospace`;
          ctx.fillStyle = t.color;
          ctx.fillText(t.subtext, x, y + baseFont * 0.95 * t.scale);
        }
      }
      ctx.restore();
    }
  }

  STYX.StyxRenderer = StyxRenderer;
})(window);
