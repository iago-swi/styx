/* ==========================================================================
   STYX // Visual Realms & Color Palettes
   5 distinct handcrafted themes that transform shaders, crystals, and audio.
   ========================================================================== */

(function (global) {
  'use strict';

  const STYX = (global.STYX = global.STYX || {});

  STYX.THEMES = [
    {
      id: 0,
      name: 'ABYSSAL NEON',
      patternId: 0, // Hexagonal Prism Lattice
      // Normalized RGB for WebGL2 shaders
      voidDeep: [0.015, 0.025, 0.075],
      voidAccent: [0.05, 0.16, 0.34],
      voidGlow: [0.12, 0.52, 0.85],
      gridColor: [0.10, 0.42, 0.72],
      borderColor: [0.22, 0.96, 1.00],
      // Claimed crystal palettes per multiplier (x1, x5, x10)
      claim1A: [0.04, 0.20, 0.48],
      claim1B: [0.12, 0.78, 0.98],
      claim5A: [0.36, 0.06, 0.48],
      claim5B: [0.98, 0.22, 0.78],
      claim10A: [0.52, 0.26, 0.04],
      claim10B: [1.00, 0.82, 0.22],
      // Entity styling (Canvas2D HDR emissive)
      styxPalette: ['#1cf5ff', '#5878ff', '#e43bff', '#ff4fa8', '#ffffff'],
      caterpillarHead: '#ff3b6b',
      caterpillarBody: ['#ff3b6b', '#ff7b29', '#ffd147'],
      playerColor: '#4ffbff',
      trailColor: '#2cf6ff',
      // Musical scale (Hz, D minor pentatonic / Dorian synthwave)
      rootHz: 73.42,
      scale: [293.66, 349.23, 392.00, 440.00, 523.25, 587.33, 698.46, 783.99, 880.00]
    },
    {
      id: 1,
      name: 'ASTRAL VIOLET',
      patternId: 1, // Voronoi Stained Glass
      voidDeep: [0.035, 0.012, 0.080],
      voidAccent: [0.22, 0.05, 0.32],
      voidGlow: [0.76, 0.22, 0.72],
      gridColor: [0.46, 0.16, 0.68],
      borderColor: [0.96, 0.42, 1.00],
      claim1A: [0.18, 0.06, 0.42],
      claim1B: [0.68, 0.32, 1.00],
      claim5A: [0.48, 0.06, 0.28],
      claim5B: [1.00, 0.30, 0.64],
      claim10A: [0.56, 0.30, 0.06],
      claim10B: [1.00, 0.86, 0.32],
      styxPalette: ['#ff3fd2', '#ff7755', '#ffd84d', '#8c52ff', '#ffffff'],
      caterpillarHead: '#2effc7',
      caterpillarBody: ['#00e5ff', '#2effc7', '#b5ff4d'],
      playerColor: '#ffd27d',
      trailColor: '#ff52d9',
      rootHz: 82.41,
      scale: [329.63, 392.00, 440.00, 493.88, 587.33, 659.25, 783.99, 880.00, 987.77]
    },
    {
      id: 2,
      name: 'EMERALD NEXUS',
      patternId: 2, // Sacred Geometric Circuitry
      voidDeep: [0.010, 0.042, 0.048],
      voidAccent: [0.04, 0.22, 0.22],
      voidGlow: [0.10, 0.78, 0.58],
      gridColor: [0.08, 0.54, 0.44],
      borderColor: [0.20, 1.00, 0.76],
      claim1A: [0.03, 0.26, 0.24],
      claim1B: [0.14, 0.94, 0.68],
      claim5A: [0.08, 0.22, 0.52],
      claim5B: [0.34, 0.72, 1.00],
      claim10A: [0.54, 0.34, 0.04],
      claim10B: [1.00, 0.88, 0.24],
      styxPalette: ['#24ff9e', '#00d9ff', '#ffee4a', '#ff5298', '#ffffff'],
      caterpillarHead: '#ff4848',
      caterpillarBody: ['#ff4848', '#ff9922', '#fff056'],
      playerColor: '#66ffd9',
      trailColor: '#2bffb4',
      rootHz: 65.41,
      scale: [261.63, 311.13, 349.23, 392.00, 466.16, 523.25, 622.25, 698.46, 783.99]
    },
    {
      id: 3,
      name: 'SOLAR FORGE',
      patternId: 3, // Molten Facet Waves
      voidDeep: [0.055, 0.014, 0.020],
      voidAccent: [0.30, 0.06, 0.08],
      voidGlow: [0.95, 0.34, 0.14],
      gridColor: [0.68, 0.22, 0.12],
      borderColor: [1.00, 0.66, 0.24],
      claim1A: [0.42, 0.08, 0.10],
      claim1B: [1.00, 0.44, 0.18],
      claim5A: [0.06, 0.24, 0.52],
      claim5B: [0.22, 0.86, 1.00],
      claim10A: [0.58, 0.38, 0.04],
      claim10B: [1.00, 0.94, 0.42],
      styxPalette: ['#ff6a1a', '#ff2266', '#ffe44d', '#33e0ff', '#ffffff'],
      caterpillarHead: '#38f2ff',
      caterpillarBody: ['#1ea7ff', '#38f2ff', '#a8ffff'],
      playerColor: '#ffdd66',
      trailColor: '#ff8a2b',
      rootHz: 87.31,
      scale: [349.23, 415.30, 466.16, 523.25, 622.25, 698.46, 830.61, 932.33, 1046.50]
    },
    {
      id: 4,
      name: 'PRISMATIC CORE',
      patternId: 4, // Iridescent Hyper-Mandala
      voidDeep: [0.018, 0.016, 0.055],
      voidAccent: [0.14, 0.12, 0.36],
      voidGlow: [0.48, 0.72, 1.00],
      gridColor: [0.36, 0.48, 0.88],
      borderColor: [0.82, 0.96, 1.00],
      claim1A: [0.08, 0.24, 0.56],
      claim1B: [0.36, 0.92, 1.00],
      claim5A: [0.46, 0.08, 0.52],
      claim5B: [1.00, 0.36, 0.90],
      claim10A: [0.58, 0.36, 0.06],
      claim10B: [1.00, 0.92, 0.38],
      styxPalette: ['#2cf6ff', '#ff36c8', '#ffe14d', '#45ff99', '#ffffff'],
      caterpillarHead: '#ff2e88',
      caterpillarBody: ['#ff2e88', '#ffb830', '#3df5ff'],
      playerColor: '#ffffff',
      trailColor: '#75f7ff',
      rootHz: 98.00,
      scale: [392.00, 466.16, 523.25, 587.33, 698.46, 783.99, 932.33, 1046.50, 1174.66]
    }
  ];

  STYX.getTheme = function (level) {
    const idx = Math.max(0, (level - 1) % STYX.THEMES.length);
    return STYX.THEMES[idx];
  };

  STYX.getLevelConfig = function (level) {
    const theme = STYX.getTheme(level);
    const tier = Math.floor((level - 1) / STYX.THEMES.length);
    const styxCount = (level >= 3 && (level === 3 || level >= 5)) ? 2 : 1;
    const caterpillarCount = Math.min(4, 1 + Math.floor(level / 2));
    const caterpillarLength = Math.min(26, 11 + level * 2);
    const styxSpeed = Math.min(2.35, 1.0 + (level - 1) * 0.14 + tier * 0.12);
    const caterpillarSpeed = Math.min(1.9, 0.85 + (level - 1) * 0.11);
    const targetPct = 80;
    return {
      level,
      theme,
      styxCount,
      caterpillarCount,
      caterpillarLength,
      styxSpeed,
      caterpillarSpeed,
      targetPct
    };
  };
})(window);
