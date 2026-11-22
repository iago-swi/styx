# Vitrail changelog

Changes to Vitrail, the Claude version of Styx, newest first. Each version is tagged `claude-vX.Y.Z` and published with these notes on the [releases page](https://github.com/iago-swi/styx/releases). The rules are in [VERSIONING.md](../VERSIONING.md).

## [1.1.3] - 2026-11-22

### Fixed

- From window 4, a cut between the two Wisps could leave a window impossible to finish. In version 1.1.2 such a cut lit nothing and split the dark into two areas with no glowing line between them, so the diamond could not reach the other area. A cut between the Wisps now lights the smaller part, and the Wisp that was there slips across into the rest. Every sealed shape lights up again, and the dark stays in one piece.

### Changed

- Following the lines is easier. A turn can be pressed before the corner: the diamond runs on and turns when it gets there, also with a single key or a swipe. Before, it stopped when the turn was not open yet.
- Near a corner, a turn pressed up to five steps early follows the line and no longer starts a cut (three steps before).

## [1.1.2] - 2026-11-21

### Fixed

- Parting the two Wisps with a cut no longer finishes the window. From window 4, one straight cut between them ended the window at once and paid a 5'000-point bonus, which made the later windows easier than the first ones and the score unlimited. The cut now simply stands: each Wisp stays on its side and the window still needs 78% or 80% of light.

### Changed

- The Wisps keep getting more dangerous: dashes aim at an open cut more often up to window 6, and the rests between dashes shorten from window 4 to window 11.
- The shared list accepts a slightly lower highest score per window, since the parting bonus is gone. Scores already on the list stay.

## [1.1.1] - 2026-11-21

### Changed

- The title screen shows the version number.

## [1.1.0] - 2026-11-21

### Added

- High scores on the device: the ten best games, each with initials, the window reached and the date. A best score saved by version 1.0.0 is carried over as the first entry, without initials.
- A second list shared between all players, on the **Everyone** tab. It is served by a Cloudflare Worker with a D1 database (`scores-worker/`). Without a connection the game still works and the device list still saves.
- **High scores** on the title screen.
- **Title screen** after a game (also `Esc`), and **End this run** on the pause screen.

### Documentation

- Technical notes in the README: the stack, the board and how panes are sealed, the rendering pipeline, movement and enemies, difficulty and scoring, the two high-score lists, sound, accessibility and testing.
- Corrections to those notes after a check against the code (bloom passes, flood fill, start keys, the test hook).
- A link to the live game.

## [1.0.0] - 2026-11-19

First release.

### Added

- Vitrail: cut the dark into panes of stained glass while the Wisp drifts through it. Light 75% of a window to finish it (78% from window 3, 80% from window 5). Two Wisps from window 4.
- Cinders that run along the lines and set an open cut on fire.
- Three diamonds per game, and a best score saved in the browser.
- Keyboard controls (arrow keys or `WASD`, pause, sound, full screen) and swipe controls on touch screens.
- Graphics and sound generated in the browser with WebGL 2 and Web Audio. The whole game is one file, `index.html`.

[1.1.3]: https://github.com/iago-swi/styx/releases/tag/claude-v1.1.3
[1.1.2]: https://github.com/iago-swi/styx/releases/tag/claude-v1.1.2
[1.1.1]: https://github.com/iago-swi/styx/releases/tag/claude-v1.1.1
[1.1.0]: https://github.com/iago-swi/styx/releases/tag/claude-v1.1.0
[1.0.0]: https://github.com/iago-swi/styx/releases/tag/claude-v1.0.0
