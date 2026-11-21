# Neon Abyss changelog

Changes to Neon Abyss, the Gemini version of Styx, newest first. Each version is tagged `gemini-vX.Y.Z` and published with these notes on the [releases page](https://github.com/iago-swi/styx/releases). The rules are in [RELEASING.md](../RELEASING.md).

## [1.1.0] - 2026-11-21

### Added

- High scores on the device: the ten best finished runs, each with initials, score, the level reached and the date. A high score saved by version 1.0.0 is migrated into the list.
- A shared list across players, on the **Everyone** tab, served by a dedicated Cloudflare Worker with a D1 database (`scores-worker/`).
- **High Scores** on the title screen.
- Initials entry on the Game Over screen, **Title Screen** after a game (also `Esc`), and **End this run** on the pause screen.

### Documentation

- Technical notes in the README, including the two high-score lists and the score service.

## [1.0.0] - 2026-11-19

First release.

### Added

- Neon Abyss: carve plasma lines across a nebula in eight directions and seal off regions to reveal crystal realms. Claim 80% to clear a realm.
- A cycling ×1 / ×5 / ×10 multiplier that rewards well-timed closures.
- Edge-crawling caterpillars, which can be crushed by sealing them inside claimed territory, and a fuse that ignites if you stall in the open.
- Keyboard controls (arrow keys or `WASD`, `Shift` for precision speed, pause, mute) and optional CRT scanlines with `C`.
- WebGL 2 rendering and Web Audio sound, with no installation or build step. The high score is saved in the browser.

[1.1.0]: https://github.com/iago-swi/styx/releases/tag/gemini-v1.1.0
[1.0.0]: https://github.com/iago-swi/styx/releases/tag/gemini-v1.0.0
