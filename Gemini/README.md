# STYX · Neon Abyss — Gemini version

A modern territory-capture arcade game built with Gemini (Google), inspired by Windmill Software's 1983 DOS classic *Styx* and Taito's *Qix*. Carve luminous plasma lines across a gravitationally warped nebula, seal off regions to reveal procedural stained-glass crystal realms, time your closures to a cycling **×1 / ×5 / ×10** multiplier, and crush edge-crawling caterpillars before the swirling Styx intercepts your tether.

All WebGL 2 shaders, procedural crystal artworks, dual-scale HDR bloom, and Web Audio synthesizer sounds run locally in the browser with zero external libraries, images, fonts, or audio files.

**[Play it in your browser](https://iago-swi.github.io/styx/Gemini/)**

![Neon Abyss gameplay: cyan, magenta, and solar gold hexagonal crystal panels framing a warped nebula grid where the iridescent Styx swirls near an active carving tether](screenshot.jpg)

## Run it

Play online with the link above, or download the `Gemini/` folder and open `index.html` directly in Chrome, Edge, or Firefox. Because scripts load via classic deferred tags under a shared `window.STYX` namespace, the game works identically over `file://` (double-click) or any static HTTP server with no installation or build step.

## How to play

Move along the glowing safe border and press into the dark void to start carving an active plasma tether. Reconnect to any safe border cell to crystallize every region that does not contain a Styx. Claim **80%** of the playfield to clear the realm and earn **+1,000** per full percentage point above 80%.

| Key | Action |
| --- | --- |
| Arrow keys or `WASD` | Move in 8 directions (hold two keys for diagonals) |
| `Shift` | Precision slow speed (`0.52×`) |
| `Space` or `Enter` | Start / Next Realm / Play Again |
| `P` or `Esc` | Pause / Resume |
| `M` | Toggle procedural synth audio |
| `C` | Toggle 1983 CRT phosphor scanlines |

| Mechanic / Hazard | Behaviour |
| --- | --- |
| **The Styx** | A swirling multi-ribbon plasma entity roaming open space. Touching your active tether or spark costs a life. From Level 3+, dual Styxes appear—separating them awards a **+5,000 Styx Split** bonus. |
| **Border Caterpillars** | Articulated cyber-centipedes patrolling the active perimeter. Touching one costs a life, but sealing one inside a newly claimed region crushes it for **+2,500 × Multiplier**. |
| **Plasma Fuse** | Stopping for more than `0.40 s` while carving ignites a high-voltage fuse at the start of your tether that chases you along your line. |
| **Multiplier Core** | Cycles continuously through **×1 Prism** (`5.5 s`, cyan), **×5 Plasma** (`3.6 s`, magenta), and **×10 Solar** (`2.4 s`, gold), tinting newly crystallized panels and multiplying area and crush scores. |

## Technical notes

### Stack & modular layout

| | |
| --- | --- |
| Delivery | Zero dependencies, zero build step, zero external assets. Works offline over `file://` or HTTP. |
| Language | Plain JavaScript (ES2020) organized into 7 modular files under `window.STYX`. |
| Rendering | Multi-pass WebGL 2 (GLSL ES 3.00) with dual-scale Gaussian HDR bloom and ACES filmic tone mapping, offscreen Canvas 2D additive emissive layer, crisp top UI canvas, and automatic Canvas 2D fallback. |
| Sound | Procedural Web Audio API synthesizer with reactive filtering, scale-locked arpeggios, and synthesized SFX. |
| Storage | One `localStorage` key, `styx_neon_abyss_highscore_v1`, for the high score. |

```text
Gemini/
|-- index.html       # Semantic arcade HUD, overlays, and layered canvases
|-- styles.css       # Frosted-glass neon UI and responsive 16:10 stage framing
|-- screenshot.jpg   # 800x500 gameplay preview
|-- README.md
`-- src/
    |-- themes.js    # 5 visual realms, shader palettes, pattern IDs, and musical scales
    |-- audio.js     # Dynamic Web Audio synth drone, arpeggiator, and procedural SFX
    |-- grid.js      # 320x200 playfield grid, O(N) BFS flood fill, and contour walker
    |-- entities.js  # Player, multi-ribbon Styx, caterpillars, and particle/FX system
    |-- renderer.js  # 5-pass WebGL 2 HDR bloom shader pipeline + 2D fallback
    |-- game.js      # 120 Hz fixed-timestep loop, scoring, progression, and HUD sync
    `-- main.js      # Responsive ResizeObserver sizing and keyboard/UI bindings
```

### The board & flood-fill territory engine

The playfield is a **320 × 200 logical grid** (a 2× high-definition homage to the 1983 DOS release's `160 × 100` CGA mode), comprising `64,000` cells (`62,964` claimable interior cells) stored in flat typed arrays (`Uint8Array` for cell states, preserved stained-glass seams, seam multiplier tints, and border halos; `Float32Array` for radial crystallization wave flashes and stagger delays).

Each cell holds one of six states: `EMPTY`, `BORDER`, `CLAIMED_1`, `CLAIMED_5`, `CLAIMED_10`, or `TRAIL`.

Because *Styx* supports **8-directional diagonal cuts**, trails are recorded with 8-connectivity while territory capture runs an iterative **4-connected breadth-first search** using preallocated `Uint8Array` visited and `Int32Array` queue buffers (zero per-claim heap allocation). Two cells separated by a 1-cell diagonal wall are not 4-connected, so diagonal cuts seal watertight without leaking.

Closing a trail executes five steps:

1. All `TRAIL` cells convert to `BORDER` and stamp `seam = 255` with the active multiplier tint (`×1`, `×5`, or `×10`).
2. A 4-connected BFS seeds from each Styx core (snapping to the nearest `EMPTY` cell if needed) and marks reachable void cells. On multi-Styx levels, discovering multiple disconnected Styx chambers triggers the **+5,000 Styx Split** bonus.
3. Every unvisited interior `EMPTY` cell becomes claimed (`CLAIMED_1`, `CLAIMED_5`, or `CLAIMED_10`) and receives a radial crystallization flash staggered by distance from the closure point (`2.8 ms` per cell, capped at `0.42 s`).
4. Any `BORDER` cell with no remaining `EMPTY` 8-neighbor is absorbed into claimed territory while keeping its `seam` flag so every historical cut remains visible as a glowing stained-glass lattice line.
5. A local 2-ring border halo pass updates the texture alpha channel for smooth GPU edge lighting.

### Multi-pass WebGL 2 rendering pipeline

The renderer targets `min(devicePixelRatio, 1.75)` inside a locked 16:10 frame and runs five GPU passes per frame:

1. **Grid state texture (`320 × 200`, `RGBA8`, `NEAREST`).** Uploaded via `texSubImage2D` only when dirty or while crystallization waves decay:
   - `R`: cell state (`EMPTY`, `BORDER`, `CLAIMED_1`, `CLAIMED_5`, `CLAIMED_10`)
   - `G`: preserved stained-glass seam mask encoded with multiplier tint
   - `B`: decaying radial crystallization flash
   - `A`: 2-ring active perimeter glow halo
2. **Pass 1 — Scene shader (full resolution).**
   - *Unclaimed void*: Computes real-time gravitational/electromagnetic UV warping around each Styx core and the player spark, drives a 2-layer 4-octave domain-warped FBM nebula, twinkles a procedural starfield, and renders a `32 × 20` magnetic flux grid that physically bends and brightens near active entities.
   - *Claimed territory*: Samples one of **5 procedural GLSL crystal artworks** selected per realm (`uPatternId` 0–4):
     - `0 · Abyssal Neon` — Hexagonal prism honeycomb with pulsing facets
     - `1 · Astral Violet` — Animated Voronoi cathedral stained glass
     - `2 · Emerald Nexus` — Sacred geometric circuit & concentric mandala
     - `3 · Solar Forge` — Molten FBM topographic contour ridges
     - `4 · Prismatic Core` — Iridescent wave-interference supernova lattice
   - Each crystal panel is tinted by its claim multiplier (`×1`, `×5`, `×10`), overlaid with a sweeping diagonal glass sheen, illuminated stained-glass cut seams, blazing active borders, and the radial crystallization wave.
3. **Pass 2 — HDR emissive vector layer.** An offscreen high-DPI Canvas 2D (`globalCompositeOperation = 'lighter'`) draws floating void motes, expanding shockwave rings, 28-frame Styx Bezier ribbons and lightning arcs, the multi-layered active plasma tether and fuse starburst, articulated caterpillars, the player diamond core and hex respawn shield, and up to `950` velocity-stretched spark needles and rotating crystal shards. The canvas is uploaded to WebGL 2 as an emissive texture.
4. **Passes 3 & 4 — Dual-scale separable Gaussian bloom.** A bright-pass extract combines scene highlights (`luminance > 0.52`) with the emissive entity layer, then blurs it through a half-resolution 9-tap separable H+V Gaussian pass (tight neon glow around thin lasers) and two quarter-resolution H+V passes (wide atmospheric radiance).
5. **Pass 5 — ACES filmic composite.** Combines the base scene, emissive entities, tight bloom, and wide bloom with radial shockwave UV refraction and RGB chromatic dispersion on big claims or deaths, micro screen-shake, edge vignette, optional 1983 CRT phosphor scanlines (`C`), and ACES filmic tone mapping.

Floating score and percentage popups render on a separate top Canvas 2D (`#ui-canvas`) above post-processing so typography remains razor-sharp.

### Simulation, movement & enemies

- **Fixed 120 Hz simulation:** Physics advances in fixed `1/120 s` steps (`rawDt` clamped to `50 ms`) with smooth visual interpolation for the player core.
- **Player (`src/entities.js`):** Moves at `92` grid cells/s along borders and `80` cells/s while drawing (normalized by `1 / √2` on diagonals and scaled by `0.52×` when holding `Shift`). Includes smart border-hugging across diagonal or stepped walls, a `90 ms` corner ledge-grace when sliding parallel along a drop-off so you do not accidentally shoot into the void at corners, a `2.0 s` respawn shield, and a **Plasma Fuse** (`0.40 s` idle threshold; advances at `76` cells/s while stalled or `42` cells/s once moving).
- **The Styx (`StyxEntity`):** A roaming core steered by harmonic curl noise coupled by elastic spring tethers to 4 orbiting ribbon vertices, each bouncing off walls in 3 sub-steps per tick. Every `22 ms` (~45 Hz), vertex positions push into a 28-frame ribbon history rendered as closed midpoint quadratic splines, longitudinal silk filaments, leading crystalline cross-diagonals, and intermittent lightning arcs. Agitation rises within `42` cells of an active player tether. Collision checks both core/vertex proximity and sampled active ribbon segments against `TRAIL` cells.
- **Border Caterpillars (`Caterpillar`):** Trace arbitrary dynamic perimeters—including concave pockets, diagonal walls, and 1-cell peninsulas—using **Moore-Neighbor contour walking** (`stepAlongBorder`). A ring buffer of recent head positions (`segmentCount × 2 + 4` steps) lets every pulsing body segment and animated perpendicular energy leg follow the exact border path. After every territory claim, any caterpillar whose head is no longer on an active `BORDER` cell is vaporized for `+2,500 × Multiplier`.

### Difficulty, multipliers & scoring

| Level | Realm | Crystal Pattern | Styxes | Crawlers | Crawler Length | Target |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Abyssal Neon | Hexagonal Prism | 1 | 1 | 13 | 80% |
| 2 | Astral Violet | Voronoi Glass | 1 | 2 | 15 | 80% |
| 3 | Emerald Nexus | Circuit Mandala | 2 | 2 | 17 | 80% |
| 4 | Solar Forge | Molten Contours | 1 | 3 | 19 | 80% |
| 5 | Prismatic Core | Interference Lattice | 2 | 3 | 21 | 80% |

From Level 6 onward, the five realms loop with escalating Styx speed (capped at `2.35×`), crawler speed (capped at `1.9×`), up to 4 crawlers, and length up to 26 segments.

- **Area claim:** `round(deltaPercent × 100) × multiplier` (minimum `10 × multiplier`)
- **Caterpillar crush:** `+2,500 × multiplier`
- **Styx split (Level 3+):** `+5,000`
- **Overclaim level bonus:** `+1,000` per full percentage point claimed above `80%`
- **Extra life:** Awarded every `50,000` points (up to 5 lives)

### Procedural Web Audio synthesizer

`src/audio.js` synthesizes all sound in real time with no audio files:

- A detuned sawtooth + triangle ambient drone routed through a resonant low-pass filter whose cutoff opens dynamically (`230 Hz` → up to `1,320 Hz`) as your active tether grows longer.
- A bandpass-filtered carving plasma hum whose pitch rises with tether length.
- A subtle realm-specific arpeggiator locked to each theme's musical scale (`D`, `E`, `C`, `F`, and `G` minor/Dorian pentatonic progressions) that accelerates while carving.
- Polyphonic crystalline claim chords (plus a sub-bass thump on `≥ 5%` captures), square-wave fuse crackle ticks, ascending crush arpeggios, filtered noise-shatter death drops, and level-clear fanfares.

### Verification

- **Automated logic tests:** Verified `PlayfieldGrid` and `Caterpillar` in Node.js across rectangular territory claims, watertight 8-way diagonal triangle flood-fill sealing, 600-tick Moore-Neighbor perimeter traversal around dynamic borders, and trapped-caterpillar crush detection.
- **Visual browser check:** Verified live WebGL 2 shader compilation, dual-scale HDR bloom, HUD sync, and `1280 × 800` gameplay rendering in Chromium with zero console errors.
