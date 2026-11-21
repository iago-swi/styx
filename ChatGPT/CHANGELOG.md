# Vector Arcade changelog

Changes to Vector Arcade, the ChatGPT version of Styx, newest first. Each version is tagged `chatgpt-vX.Y.Z` and published with these notes on the [releases page](https://github.com/iago-swi/styx/releases). The rules are in [VERSIONING.md](../VERSIONING.md).

## [1.1.1] - 2026-11-21

### Changed

- The start screen shows the version number.

## [1.1.0] - 2026-11-21

### Added

- **This device** keeps the ten highest-scoring completed runs with a positive score, including their initials, points, sector and date.
- An existing personal best carries over to **This device**, with dashes for the unknown initials, sector and date.
- **Everyone** shows the shared top ten, with older runs winning ties.
- Finishing with a positive score submits your run automatically, even if you leave your initials blank.
- The game highlights your qualifying finish and shows your shared rank if you finish outside the top ten.
- You can enter up to three letters or digits at game over, and the game remembers them for your next run.
- Qualifying scores still save on your device when the shared board is offline.
- **High scores** beside the trophy before a game starts.
- **Quit** at game over, which returns to the start screen.

### Changed

- The **Best** readout now shows the first entry on your device list. An unfinished run no longer raises it.

### Documentation

- The game guide explains both score lists, and the repository overview and shared landing page introduce the shared board.
- Technical notes on the implementation, with a verified capture example.
- A gameplay screenshot and a link to the live game.

## [1.0.0] - 2026-11-19

First release.

### Added

- Steer a white diamond across a nebula and close your trail to claim the area cut off from the Styx.
- Claim 80% to advance to a faster sector. A third crawler joins in sector three.
- Larger captures earn more points, and each new sector increases their value.
- Edge crawlers that patrol the boundary.
- Three lives per game, and a best score saved in the browser.
- Keyboard controls (arrow keys or `WASD`, `Space` to pause, `M` for sound), swipe controls and direction buttons on touch screens.
- Open the field manual for instructions.
- Expand the playfield to fill the screen.
- Restart a run from the pause screen.
- Switching tabs automatically pauses an active run.
- Runs from static files with no installation or build step.

[1.1.1]: https://github.com/iago-swi/styx/releases/tag/chatgpt-v1.1.1
[1.1.0]: https://github.com/iago-swi/styx/releases/tag/chatgpt-v1.1.0
[1.0.0]: https://github.com/iago-swi/styx/releases/tag/chatgpt-v1.0.0
