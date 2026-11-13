---
description: Finish a work session — test, check scope, commit, push, draft PR
---
1. Run `npm test`. If the user is Dev 3, also run `pytest` in `pipeline/`. Stop and report on failure.
2. `git diff --name-only main...` — warn about any changed file outside the user's area (see CLAUDE.md) and name its owner.
3. Make sure no kernels, DEMs or `data/raw/` files are staged.
4. Propose a conventional commit message and WAIT for the user's OK.
5. Push the branch and open a DRAFT PR for Dev 1 to review, listing changed files and decisions the reviewer must make.
6. Add a one-line entry to `pipeline/AI_USE_LOG.md`.
