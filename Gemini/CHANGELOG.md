# Neon Abyss changelog

Changes to Neon Abyss, the Gemini version of Styx, newest first. Each version is tagged `gemini-vX.Y.Z` and published with these notes on the [releases page](https://github.com/iago-swi/styx/releases). The rules are in [VERSIONING.md](../VERSIONING.md).

## [1.1.1] - 2026-11-21

### Changed

- The title screen shows the version number.

## [1.1.0] - 2026-11-21

### Added

- High scores on the device: the ten best finished runs, each with initials, score, the level reached and the date. A high score saved by version 1.0.0 is migrated into the list without initials or date, and equal scores rank behind older ones.
- A shared list across players, on the **Everyone** tab, backed by a dedicated Cloudflare Worker with a D1 database (`scores-worker/`). Without a connection, the game still works and your score is kept on this device.
- **High Scores** on the title screen.
- Initials entry on the Game Over screen (up to three letters or digits, remembered for later runs and updated in place on the shared list), **Title Screen** after a game (also `Esc`), and **End this run** on the pause screen.

### Changed

- The persistent high score is now recorded only when a run finishes rather than mid-run, so ending a run early no longer saves it.

### Documentation

- Technical notes in `Gemini/README.md`, including the playfield, rendering pipeline, enemies, sound, both high-score lists and the score service.
- Updated Neon Abyss's description on the shared landing page (`index.html`) and repository `README.md`.

## [1.0.0] - 2026-11-19

First release.

### Added

- Neon Abyss: carve plasma lines across a nebula in eight directions and seal off regions across five looping crystal realms. Claim 80% to clear a realm, with `+1,000` for each full percentage point above 80%.
- Two Styxes starting from level 3, with a `+5,000` Styx Split bonus for separating them.
- A cycling ×1 / ×5 / ×10 multiplier that rewards well-timed closures.
- Edge-crawling caterpillars, which can be crushed by sealing them inside claimed territory, and a fuse that ignites if you stall in the open.
- Three starting lives (plus an extra life every `50,000` points, up to five) and a high score saved in the browser.
- Keyboard controls (arrow keys or `WASD`, `Shift` for precision speed, pause, mute) and optional CRT scanlines with `C`.
- WebGL 2 rendering (with automatic Canvas 2D fallback) and Web Audio sound, with no installation or build step.
- Added Neon Abyss to the shared landing page (`index.html`) and repository `README.md`.

[1.1.1]: https://github.com/iago-swi/styx/releases/tag/gemini-v1.1.1
[1.1.0]: https://github.com/iago-swi/styx/releases/tag/gemini-v1.1.0
[1.0.0]: https://github.com/iago-swi/styx/releases/tag/gemini-v1.0.0
