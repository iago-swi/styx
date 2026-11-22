# Vitrail — Claude version

A territory-cutting arcade game built with Claude (Anthropic), in the genre of Styx and
Qix but with its own theme: you are a diamond glass-cutter, and every region you seal
becomes a pane of backlit stained glass. A finished level is a glowing window.

The whole game is one file, `index.html`. Graphics and sound are generated in the
browser (WebGL 2 and Web Audio); there are no image or audio files. The ten best
scores are kept on your device, and a second list is shared between all players.

**[Play it in your browser](https://iago-swi.github.io/styx/Claude/)** · [What changed in each version](CHANGELOG.md)

![Vitrail gameplay: seven sealed panes of red, blue, yellow, green and violet glass around a dark area where the Wisp drifts](screenshot.jpg)

## Run it

Play online with the link above, or download the folder and open `index.html` in a
current version of Chrome, Edge or Firefox. No installation,
build step or web server is needed. The two typefaces load from Google Fonts; without
an internet connection the game falls back to system fonts and keeps its high scores
on the device only.

## How to play

Steer the diamond along the glowing line. Turn into the dark to start a cut, and reach
any line again to seal the pane: everything on the side without the Wisp lights up.
Light 75% of the window to finish it (78% from window 3, 80% from window 5).

| Key | Action |
| --- | --- |
| Arrow keys or `WASD` | Move |
| `P` or `Esc` | Pause |
| `M` | Sound on/off |
| `F` | Full screen |
| `Enter` or `Space` | Start |
| `Esc` after a game | Back to the title screen |

On a touch screen, swipe to steer and tap to stop.

A turn can be pressed before the corner: on a line, the diamond runs on and turns as
soon as the way opens.

| Danger | What it does |
| --- | --- |
| The Wisp | Drifts in the dark and dashes now and then. If it or its tendrils touch an unfinished cut, you lose a diamond. |
| Cinders | Run along the lines and hunt you. Touching one costs a diamond. If one reaches the start of your open cut, the cut catches fire and the flame chases you. |
| Boxing yourself in | A cut cannot cross itself. With no way out, you lose a diamond. |

You have three diamonds. One large pane scores more than several small panes
covering the same area. From
window 4 there are two Wisps. A cut between them lights the smaller part, and the Wisp
that was there slips across to join the other.

When a game ends, "Cut again" starts the next one and "Title screen" leads back to
the opening screen. A paused game can be given up with "End this run": it ends like
any other game, and its score counts.

The ten best scores are kept in the browser, each with three initials, the window
reached and the date. The list is shown when a game ends and opens from the title
screen under "High scores". A score that makes the list is saved at once; the initials
can be typed or changed next to it and are remembered for the next game.

Next to "This device" there is a second tab, "Everyone": the ten best scores of all
players. Every finished game with a score is sent there with your initials, and
nothing else about you.

## Technical notes

### Stack

| | |
| --- | --- |
| Delivery | One `index.html` of about 1,210 lines (82 KB): markup, CSS, JavaScript and GLSL together. No dependencies, no build step. |
| Language | Plain JavaScript in a single closure, no framework. |
| Rendering | WebGL 2 (GLSL ES 3.00) for the scene and post-processing, Canvas 2D for lines, creatures and sparks, HTML and CSS for the score bar and screens. |
| Sound | Web Audio API. Every sound is synthesised; there are no audio files. |
| Type | Bodoni Moda and Instrument Sans from Google Fonts, with system fallbacks. |
| Storage | `localStorage` only: `vitrail.scores` (the high-score list), `vitrail.name` (the initials used last), `vitrail.best` and `vitrail.list` (which list is on view). |
| Network | Google Fonts, and the shared high-score list (see [High scores](#high-scores)). The game plays without either. |
| Requirements | A browser with WebGL 2. `EXT_color_buffer_float` is used for HDR render targets when present; otherwise the game falls back to 8-bit targets. |

### The board

The field is a lattice of 96 × 60 steps stored as a 193 × 121 cell grid (`Uint8Array`).
The cutter only stops on cells with two even coordinates; cells with two odd
coordinates are pure area. Every line is therefore a 4-connected wall of cells, and
every sealed region has an interior, so a flood fill can never leak through a
diagonal.

A cell is in one of four states: dark, line, glass, or open cut.

Sealing a cut works like this:

1. The open cut becomes line.
2. A 4-connected flood fill starts from the dark cell nearest each Wisp. It is
   iterative and uses a preallocated `Int32Array` stack, so there is no recursion.
3. Every dark cell the fill did not reach becomes glass and gets the next pane colour.
4. Every line cell with no dark cell among its eight neighbours stops being a live
   line and becomes lead between panes.
5. With two Wisps, the fill starts from both and counts the cells of each area. If a
   cut has parted them, only the larger area stays dark; the Wisp in the other one is
   moved to the nearest dark cell with room around it. The dark therefore stays in one
   piece, and every live line can still be reached.

Cinders that end up on a dead line are moved to the nearest live one.

### Rendering pipeline

Each frame runs these passes:

1. **Mask texture.** The grid is packed into a 193 × 121 RGBA texture: red is the fill
   amount (0 dark, 0.5 on a live line, 1 glass), green is a flash that decays after a
   pane is revealed, blue marks lead, alpha carries the pane colour index.
2. **Light layer.** Live lines, the open cut, the cutter, Wisps, Cinders, sparks and
   score pop-ups are drawn on an offscreen 2D canvas with additive blending, then
   uploaded as a texture.
3. **Scene shader.** One full-screen fragment shader reads the mask and paints the
   dark, the glass and the lead, then adds the light layer.
4. **Bloom.** Five downsample passes, the first with a brightness threshold of 0.62,
   then four upsample passes in the dual-filter style.
5. **Final grade.** Up to four shockwave distortions, chromatic aberration, ACES tone
   mapping, a vignette and film grain.

The mask is sampled twice. Bilinear filtering turns the blocky fill, flash and lead
channels into smooth edges, and the edge of a pane starts at the 0.5 contour, which
runs through the centre of its border line. The colour index is read unfiltered
with `texelFetch`, so colours never blend across a lead line.

A new pane is not shown at once: each cell gets a reveal time proportional to its
distance from the point where the cut closed (3.4 ms per cell), which produces the
wave of light.

The glass is 4-octave value noise with quintic interpolation, domain-warped once.
Screen-space derivatives (`dFdx`, `dFdy`) of that height field give a surface normal
for diffuse and specular light. The ripple pattern is almost static; the backlight
moves behind it.

The render resolution follows the device pixel ratio up to 2 and is capped at
2.3 megapixels.

### Movement and enemies

- **Cutter.** 22 lattice steps per second. Movement consumes a distance budget per
  frame, so the speed does not depend on the frame rate. The most recently pressed
  direction that can move wins. On a line, a turn pressed early is kept. If the key
  points at glass, the cutter runs on the way it was going and turns when the way
  opens. If it points at the dark and the line itself turns that way within five
  steps, the cutter follows the line and starts no cut. The direction is remembered
  for 0.2 s after a stop, which bridges the gap between two key presses.
- **Wisp.** A wandering heading with random turn rate and speed, bounced off lines and
  glass by a circle-against-grid test, in sub-steps of at most 0.45 cells. A dash has
  three phases: a 0.6 s warning, 0.5 to 0.85 s at 2.3 times base speed, then 3.5 to
  8 s of rest, which shortens in later windows. While you are cutting, a dash may aim
  at you. The seven tendrils are
  chains of 15 points that follow their leader at a fixed spacing; any point touching
  an open cut counts as a hit.
- **Cinders.** They walk the graph of live lines. Every 2.5 to 5.5 s a Cinder may run
  a breadth-first search for the shortest way along the lines to you, or to the start
  of your open cut, and turn that way. The flame it lights travels at 1.3 times your
  speed.

### Difficulty and scoring

| | Window 1 | Per window after |
| --- | --- | --- |
| Share to light | 75% | 78% from window 3, 80% from window 5 |
| Wisps | 1 | 2 from window 4 |
| Wisp base speed (cells per second) | 21.6 | +2.6 |
| Chance that a dash aims at an open cut | 45% | +10 points, 95% from window 6 |
| Rest between dashes | 3.5 to 8 s | 7% shorter per window from window 4, down to 45% of that from window 11 |
| Cinders | 1 | 2 from window 2, 3 from window 4, 4 from window 6 |
| Cinder speed (steps per second) | 12.8 | +1.3 |

A pane that lights *g* percent of the window scores (80 *g* + 6 *g*²) × (1 + 0.25 ×
(window − 1)), rounded to ten, so one large pane beats several small ones. Finishing a
window adds 1000 × window, plus 500 per percentage point above the target. A cut that
parts two Wisps scores like any other pane.

The five colour themes (Rosace, Aube, Abysse, Braise, Givre) repeat from window 6.

### High scores

**On this device.** The list is a JSON array of up to ten entries (initials, score,
window reached, date) under one `localStorage` key. It is read as untrusted data:
entries of the wrong shape are dropped, initials are reduced to three letters or
digits, and names reach the page as text, never as markup. A score equal to an older
one ranks below it. A best score saved before the list existed becomes its first
entry, without initials. The game played online and a downloaded copy keep separate
lists, because a browser stores data per address.

While the initials field has the focus, the game's own keys are switched off, so
typing `A`, `M` or `P` does nothing but type. Key repeat is ignored there too, so a
steering key still held down when the game ends cannot fill the field.

**Shared between players.** GitHub Pages only serves files and cannot store a score,
so a shared list needs a service elsewhere. [scores-worker/](scores-worker/) holds
one: a Cloudflare Worker (about 85 lines) in front of a D1 database with a single
table. The service runs at `https://vitrail-scores.iago-swi.workers.dev/`; that
address is the constant `SHARED` in `index.html`. With an empty address the game
keeps to the device, makes no requests for scores and hides the two tabs.

| | |
| --- | --- |
| Reading | `GET /?game=vitrail` returns the ten best runs. |
| Writing | `POST` with the initials, the score, the window reached and a random key that the game makes up for each run. Sending the same key again only changes the initials, so a retry or an edit never adds a second entry. |
| What is stored | Game, key, initials, score, window, time. No address and no browser details. |
| Checks | A browser game cannot prove its score, so the service refuses only what the rules make impossible: it recomputes the lowest and highest score possible for the window reached and rejects anything outside, anything not a multiple of 10, and malformed requests. A plausible invented score would pass. |
| Limits | 30 new entries per minute for all players together; 200 rows kept. |
| Failure | If the service cannot be reached the game says so and keeps the score on the device. It is not sent later. |

The request body is sent as plain text, which browsers class as a simple request, so
no CORS preflight is needed and a score costs one round trip.

### Sound

A drone of six detuned oscillators runs through a low-pass filter swept by a slow LFO,
with a feedback delay (0.34 s) as reverb. Bells are a sine fundamental with two
inharmonic partials (2.756 and 5.404 times the fundamental), which gives the struck
glass tone. Bell notes come from a minor pentatonic scale on a root that changes with
the theme; only the shatter when you lose a diamond uses random high pitches.
An open cut sounds a tone that rises with its length.

### Accessibility and behaviour

- With `prefers-reduced-motion`, screen shake, shockwaves, the chromatic flash and
  the title animation are switched off.
- A game in progress pauses when the tab is hidden.
- Every screen can be left with the keyboard: `Enter` starts or restarts, `Esc` closes
  the high-score screen or returns to the title after a game, and buttons show a
  focus ring.
- Touch input: a swipe sets the direction, a tap stops.

### Testing

`window.__vitrail` exposes part of the game state (score, diamonds, share lit, cutter,
Wisps, Cinders, the two score lists), simulated key presses, and a `step(dt)` function
that advances the simulation by a fixed time step. The game was checked with scripted
runs through this hook (cutting, sealing, level change, fuse, Wisp hit, game over)
rather than by timed play, so frame rate on slower graphics hardware has not been
measured.

The high-score list was checked the same way (first entry, initials, ties, a full
list, a score too low, a best score from before the list, damaged stored data), with
real key presses for the initials field, at eight window sizes between 568 × 320 and
1280 × 720. The shared list was tested against the Worker running on the development
machine with a local database, including refused scores, renaming, ranking and an
unreachable service; the rate limit was not exercised. The deployed service was then
checked with the same requests and with one complete game sent from the game itself;
the test entries were removed afterwards. "Title screen", "End this run" (with and
without a score, also during an open cut) and `Esc` after a game were checked with
scripted runs and real clicks. The rule for two Wisps and the early turns were checked
with scripted runs on a board with two motionless Wisps (a cut between them, a pocket
around one, turns pressed early towards glass and towards the dark, the 0.2 s after a
stop); they were not judged by hand for feel. None of this has been tried on a real touch screen,
and sound was not checked by ear.
