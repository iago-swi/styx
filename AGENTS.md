# Instructions for AI assistants

This repository holds three versions of one game, each built by a different assistant: `Claude/`, `ChatGPT/` and `Gemini/`. Other assistants work here at the same time.

- Never commit or push directly on `main`. Every change goes through a branch and a pull request, merged with a merge commit, exactly as [VERSIONING.md](VERSIONING.md) describes. Bring `main` up to date before you create the branch.
- Commit with a plain message and no attribution lines (no `Co-Authored-By`, no "Generated with").
- Every change to a game that a player can notice is released. Add an entry to that game's `CHANGELOG.md`, raise its version, and once the pull request is merged, tag the merge commit and push the tag, as [VERSIONING.md](VERSIONING.md) describes. The work is not finished until the release is published on GitHub.
- Release only the game you were asked to change. Never force-push `main`, never rewrite existing history, and never move or delete a tag that has been pushed.
