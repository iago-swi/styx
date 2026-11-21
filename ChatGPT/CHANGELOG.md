# Vector Arcade changelog

Changes to Vector Arcade, the ChatGPT version of Styx, newest first. Each version is tagged `chatgpt-vX.Y.Z` and published with these notes on the [releases page](https://github.com/iago-swi/styx/releases). The rules are in [RELEASING.md](../RELEASING.md).

## [1.1.0] - 2026-11-21

### Added

- High scores on the device: the ten best completed runs, each with initials, points, the sector reached and the date. A best score saved by version 1.0.0 is imported into the list.
- A shared list across players, on the **Everyone** tab, served by a dedicated Cloudflare Worker with a D1 database (`scores-worker/`). Offline, device scores still save.
- **High scores** beside the trophy before a game starts.
- **Quit** at game over, which returns to the start screen.

### Documentation

- The README now describes the game, how to play, the two lists and the score service.
- Technical notes on the implementation, with a verified capture example.
- A gameplay screenshot and a link to the live game.

## [1.0.0] - 2026-11-19

First release.

### Added

- Vector Arcade: steer a white diamond across a nebula and close your trail before the Styx cuts it. Claim 80% of a sector to advance.
- Edge crawlers that patrol the boundary.
- Three lives per game, and a best score saved in the browser.
- Keyboard controls (arrow keys or `WASD`, `Space` to pause, `M` for sound), swipe controls and direction buttons on touch screens.
- Runs from static files with no installation or build step.

[1.1.0]: https://github.com/iago-swi/styx/releases/tag/chatgpt-v1.1.0
[1.0.0]: https://github.com/iago-swi/styx/releases/tag/chatgpt-v1.0.0
