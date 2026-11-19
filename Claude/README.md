# Vitrail — Claude version

A territory-cutting arcade game built with Claude (Anthropic), in the genre of Styx and
Qix but with its own theme: you are a diamond glass-cutter, and every region you seal
becomes a pane of backlit stained glass. A finished level is a glowing window.

The whole game is one file, `index.html`. Graphics and sound are generated in the
browser (WebGL 2 and Web Audio); there are no image or audio files.

![Vitrail gameplay: seven sealed panes of red, blue, yellow, green and violet glass around a dark area where the Wisp drifts](screenshot.jpg)

## Run it

Open `index.html` in a current version of Chrome, Edge or Firefox. No installation,
build step or web server is needed. The two typefaces load from Google Fonts; without
an internet connection the game falls back to system fonts.

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
| `Enter` | Start |

On a touch screen, swipe to steer and tap to stop.

| Danger | What it does |
| --- | --- |
| The Wisp | Drifts in the dark and dashes now and then. If it or its tendrils touch an unfinished cut, you lose a diamond. |
| Cinders | Run along the lines and hunt you. Touching one costs a diamond. If one reaches the start of your open cut, the cut catches fire and the flame chases you. |
| Boxing yourself in | A cut cannot cross itself. With no way out, you lose a diamond. |

You have three diamonds. Larger panes score more than several small ones. From
window 4 there are two Wisps; separate them with a cut and the window is finished
at once. The best score is kept in the browser.

## How it is built

- The board is a 193 × 121 cell grid. Sealing a cut runs a flood fill from the Wisp;
  whatever it cannot reach becomes glass, and border lines that no longer touch the
  dark become the lead between panes.
- The grid is uploaded as a small texture each frame. A fragment shader paints the
  glass, the lead and the dark from it.
- Lines, creatures and sparks are drawn on a 2D canvas, then added to the scene and
  passed through an HDR bloom chain.
