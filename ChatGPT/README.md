# STYX · Vector Arcade

![Vector Arcade gameplay: a cut in progress on a teal-bordered field, with the pink Styx swirling over a nebula and a score panel on the right](screenshot.jpg)

Open `index.html` in a browser to play offline. All game code, sounds, and artwork run locally. No installation or build step is required.

Press **Enter** to start. Steer the white diamond with **WASD** or the **arrow keys**. Each turn sets your direction until you turn again, reach the edge, or close a trail. On a touchscreen, swipe across the field or use the direction buttons.

Leave the cyan territory and return to safe ground to capture the area separated from the Styx. Avoid crossing your trail, letting the Styx cut it, or meeting an edge crawler. You start with three lives. Claim **80%** to advance to the next sector.

Use **Space** to pause or resume and **M** to toggle sound. The game saves your best score in the browser when local storage is available.

<a id="how-it-is-built"></a>

## Technical notes

### Stack and source layout

Vector Arcade is a static browser game. A deferred script starts the simulation once the HTML controls exist. The same files run from GitHub Pages or directly from disk. [Play Vector Arcade](https://iago-swi.github.io/styx/ChatGPT/)

| File | What it contributes |
| --- | --- |
| [index.html](index.html) | The visible canvas, score and territory readouts, native help dialog, overlay buttons, and inline SVG icons. |
| [game.js](game.js) | The grid, capture algorithm, crawler patrols, Styx geometry, Canvas 2D renderer, Web Audio cues, and input handlers. |
| [style.css](style.css) | The arcade console layout, nebula background, compact controls, fullscreen fallback, and keyboard focus styles. |
| [nebula.webp](nebula.webp) | The 79 KiB space backdrop. Moving objects and claimed territory are drawn over this image. |

### How a cut claims territory

The board has **168 × 100 cells**. A flat `Uint8Array` stores one byte per cell at index `y * 168 + x`. A zero means open space. A one marks safe ground, including the permanent outer rim. The percentage uses only the **166 × 98 = 16,268 interior cells**. Each sector opens with 2,994 interior cells already claimed in the stepped corners, which gives the player a choice of starting edges.

An exposed trail lives in two structures. The ordered `trails` array lets the renderer draw the line from its origin to the player. A `Set` of cell indices lets the game check whether the player or the Styx has touched it. Losing a life discards both structures, so an interrupted cut leaves earlier territory intact.

When the player returns to safe ground, `claim()` performs the capture:

1. Mark every trail cell as safe. The cut now forms a wall that the search cannot cross.
2. Start at the cell under the center of the Styx. If the new wall occupies that cell, find the nearest remaining open cell as the starting point.
3. Run a breadth-first flood fill through the four cardinal neighbors. A byte array records visits and an integer queue holds cells awaiting exploration. Each reachable cell enters the queue once, so the fill takes at most one visit per board cell.
4. Claim every cell the search could not reach. A cut can therefore win the larger region when it leaves the Styx in a small pocket.
5. Rebuild the terrain outlines and patrol route, update the HUD, and test the 80% sector target.

**Worked example.** Start Sector 01 and press Up from the initial diamond at `(41, 80)`. With the Styx east of the cut when it closes at `(41, 0)`, the claimed area grows from 2,994 to 5,253 cells. The 2,259 newly secured cells add **13.886 percentage points**. The HUD moves from **18% to 32%** and the score increases by **1,389**. Scoring uses the underlying cell counts before the HUD rounds the percentages down.

### Rendering pipeline

1. **Build the field geometry.** After a capture, `rebuildTerrain()` scans each row and merges consecutive cells of the same type into rectangles. These form two `Path2D` objects, one for claimed territory and one for open space. Each side of an open cell touching safe ground contributes an edge to the cyan outline.
2. **Cache the terrain.** `paintTerrain()` draws the grid, crosshairs, translucent claimed areas, diagonal hatching, and glowing border into a second canvas. A change to the terrain or canvas dimensions invalidates this cache. An ordinary animation frame copies the finished layer in one draw.
3. **Draw the Styx inside open space.** The renderer clips the enemy to the open-region path. A radial gradient gives it a faint aura. Screen blending brightens the overlapping coral, gold, and pink curves. Selected strands receive a wider translucent stroke to give their edges a glow.
4. **Draw the actors.** Seven graduated dots form each crawler. The renderer then draws the exposed line, the white player diamond, and short-lived sparks. A successful closure emits pairs of sparks at every fifth trail cell, so the flash follows the shape of the cut.

A `ResizeObserver` measures the visible canvas. Its backing resolution follows the device pixel ratio up to **2×**, while separate horizontal and vertical scales map the same logical grid into the available space. Resizing a window or expanding the playfield preserves the board, the trail, and enemy positions.

### How the Styx moves and glows

The motion has two parts. The center drifts continuously through the open field. Each axis tests its proposed destination against the grid and reverses velocity on contact with safe ground. Around that center, `enemyGeometry()` builds **43 closed curves**, each sampled at **121 points** over a full turn. Each coordinate combines sine and cosine waves at several frequencies. Small phase shifts between adjacent curves make them separate, fold over one another, and come back together as the animation advances.

Trail collision uses these same coordinates. The game samples every third curve, giving **15 curves × 121 points** to check against the exposed trail when the player is vulnerable. This explains two things you can see while playing: a ribbon tip can cut the line while the center is well clear, and the diffuse glow outside the filaments is harmless.

### Movement, patrols, and lives

| Actor | How it moves and makes contact |
| --- | --- |
| Player | A directional press sets one cardinal heading. Movement accumulates time and spends 32 ms per grid step, about 31 cells per second in steady travel. Closing a trail clears the heading so the player stops on safe ground. Crossing an exposed trail costs a life after the grace period. |
| Styx | There is one Styx in each sector. Its base horizontal and vertical velocities increase with the sector number. Time-varying sine terms bend its course between wall contacts. |
| Crawlers | The boundary edges are linked into closed loops. The longest loop becomes the patrol route. The first two crawlers travel in opposite directions. After a capture, each resumes at the route point nearest its previous position. Its head and following segments can hit the player or the starting point of an exposed cut. |

The player begins a run with three lives and gets **1.7 seconds** of grace at the start of each sector. A hit during a cut sends the player back to the point where the line left safe ground. A surviving player then has **2.1 seconds** of grace. Score, lives, and elapsed run time carry into the next sector.

### Difficulty and scoring

| Sector | Name | Crawlers | Patrol speed |
| --- | --- | ---: | ---: |
| 1 | Outer Drift | 2 | 8.5 edges/s |
| 2 | Ion Passage | 2 | 10 edges/s |
| 3 | Violet Reach | 3 | 11.5 edges/s |
| 4 | Night Meridian | 3 | 13 edges/s |
| 5 | Event Horizon | 3 | 14.5 edges/s |

The five names repeat from Sector 6. The capture target stays at **80%**, and crawler speed continues to rise by **1.5 edges per second** each sector. The score for a closure is `max(1, round(percentagePointsGained × 100 × sector))`. For example, a gain of exactly 5 percentage points earns 500 points in Sector 1 and 1,500 in Sector 3.

### Frame timing, input, and pause

The animation loop uses `requestAnimationFrame` and targets 60 updates per second during play and 30 in other states. Enemy movement and particle lifetimes use elapsed frame time. The player uses the 32 ms grid-step accumulator so crossing a cell boundary is a discrete event. A single update consumes at most 60 ms of elapsed time, limiting how far actors can jump after a slow frame.

Keyboard events, swipe gestures, and the direction pad all feed the same steering function. A swipe chooses its dominant axis once displacement exceeds 13 CSS pixels, then resets its reference point so another turn can follow within the same gesture. At widths of 800 pixels or less, the start and pause button moves into the playfield footer.

Hiding the tab pauses an active run. Opening the field manual also pauses play, and closing it resumes a run that was active when the manual opened. The reduced-motion preference stops the standby animation and CSS transitions. The score, lives, territory meter, and status messages are HTML elements alongside the canvas, so assistive technology can read those values.

### Sound and saved settings

The first sound-enabled user interaction creates or resumes a Web Audio context. Each cue schedules an oscillator through its own gain node. Pitch changes exponentially, the volume rises over 8 ms, and the sound fades before the oscillator stops.

| Event | Synthesized cue |
| --- | --- |
| Leave safe ground | A 65 ms sine sweep from 320 to 240 Hz marks the instant the trail becomes exposed. |
| Seal a cut | A 370–600 Hz rise starts immediately. A second 650–1,000 Hz rise enters 90 ms later, overlapping the end of the first. |
| Lose a life | A triangle wave falls from 210 to 40 Hz over 350 ms. |
| Clear a sector | An 800–1,400 Hz rise enters 200 ms after the capture cue begins. |

The browser stores the best score under `styx-best` and the sound preference under `styx-audio`. If storage is unavailable, the current run still keeps both values in memory.

### Verification

The worked example above was replayed against the game logic with the Styx on the east side of the cut. Checks covered the exact cell gain and score, loss of an exposed trail after self-contact, return to its origin, and lives carried through a sector transition. A keyboard play-test in the browser also reproduced the 1,389-point opening cut and confirmed that pausing retained the captured field.
