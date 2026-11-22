# Versions and release notes

Each game in this repository has its own version number, its own changelog and its own releases. Three assistants work here, so each one releases only its own game.

| Game | Folder | Changelog | Tags |
| --- | --- | --- | --- |
| Vitrail | `Claude/` | [Claude/CHANGELOG.md](Claude/CHANGELOG.md) | `claude-vX.Y.Z` |
| Vector Arcade | `ChatGPT/` | [ChatGPT/CHANGELOG.md](ChatGPT/CHANGELOG.md) | `chatgpt-vX.Y.Z` |
| Neon Abyss | `Gemini/` | [Gemini/CHANGELOG.md](Gemini/CHANGELOG.md) | `gemini-vX.Y.Z` |

Published releases: <https://github.com/iago-swi/styx/releases>

## Rules

1. Every change to a game that a player can notice gets a new version, with a section in that folder's `CHANGELOG.md`. The change is finished when its release is published. Several changes pushed together are one version, numbered by the largest of them.
   Documentation-only changes (a README, a screenshot) get no version. They are committed as usual and can be listed under `Documentation` in the next version's notes.
2. The version is `X.Y.Z`:
   - `Z` goes up when something is fixed or adjusted and nothing new is added: a bug fix, tuning, wording, visual polish.
   - `Y` goes up when the player gets something new: a feature, a screen, a control, a level. `Z` returns to 0.
   - `X` goes up for a rebuild, or a change that makes earlier scores or saved data invalid. `Y` and `Z` return to 0.
3. The tag is the folder name in lower case, `-v`, and the version: `claude-v1.2.0`.
4. A pushed tag is never moved or deleted. A mistake is corrected with a new version.
5. Shared files (the root `index.html` and `README.md`, this file, `.github/`) have no version. If a release also changes them, say so in that game's notes.
6. A game shows its version on its title screen and declares it in its `index.html` as `<meta name="version" content="X.Y.Z">`. The release workflow refuses to publish when that number differs from the tag. Vitrail does this from 1.1.1; Vector Arcade and Neon Abyss add it with their next release.

## Releasing a change

Every change reaches `main` through a branch and a pull request. Nobody commits or pushes directly on `main`. `main` is never force-pushed, and existing history is not rewritten.

When the owner says "publish", do all the steps below. When the owner says "open a pull request", stop after step 4 and give the link.

1. Bring `main` up to date and create a branch from it. Name it `release/<tag>` for a version, and `docs/<short-name>` for a change to the documentation only:

   ```bash
   git switch main
   git pull
   git switch -c release/claude-v1.2.0
   ```

2. Add a section at the top of the game's `CHANGELOG.md`, above the previous version:

   ```markdown
   ## [1.2.0] - 2026-12-03

   ### Added

   - What the player can now do, in a plain sentence.
   ```

   Use the headings that apply: `Added`, `Changed`, `Fixed`, `Removed`, `Documentation`. Write for players first, then for people who read the code. Add the link line for the new version at the bottom of the file.

   Set the same number in the game's `<meta name="version">`, which the title screen displays.

   A change to the documentation alone skips this step.

3. Commit on the branch, the changelog together with the change. Commit under the owner's Git identity, with a plain message and no attribution lines (no `Co-Authored-By`, no "Generated with").

4. Push the branch and open a pull request. The title is the version number and a few words. The body is the changelog section for this version, in plain language for users. For a change to the documentation alone, the body says what changed.

   ```bash
   git push -u origin release/claude-v1.2.0
   gh pr create --title "Vitrail 1.2.0: touch buttons" --body-file notes.md
   ```

5. Merge the pull request with a merge commit, not a squash and not a rebase:

   ```bash
   gh pr merge --merge --delete-branch
   ```

6. Tag the merge commit on `main`, and push the tag on its own:

   ```bash
   git switch main
   git pull
   git tag -a claude-v1.2.0 -m "Vitrail 1.2.0"
   git push origin claude-v1.2.0
   ```

   A change to the documentation alone gets no version, no tag and no release: it ends at step 5.

7. Pushing the tag starts the [Release workflow](.github/workflows/release.yml). It reads the section for that version from the changelog and publishes it as a GitHub release titled with the game's name and version. Check the result:

   ```bash
   gh release view claude-v1.2.0
   ```

## Correcting a release note

Edit the changelog and publish the edit as a change to the documentation (branch `docs/<short-name>`, pull request, merge). Then run the workflow again for the existing tag, which replaces the published notes:

```bash
gh workflow run release.yml -f tag=claude-v1.2.0
```

The same command publishes a release for a tag whose workflow run failed.

## Using this in another repository

The workflow has nothing specific to this repository. Copy `.github/workflows/release.yml` and this file. A repository with a single project uses a `CHANGELOG.md` at its root and tags without a prefix: `v1.2.0`.
