---
description: Start a work session — role card, sync, tool check, next task
---
1. If you don't know which developer the user is, ask (1, 2 or 3). Show their role card from CLAUDE.md.
2. Run `git status`. If the tree is clean, switch to `main` and `git pull`.
3. List the user's local branches, and open PRs with `gh pr list` if `gh` exists.
4. Check tools: Node 22+ for everyone; Dev 3 also needs Python 3.11+. Report what's missing; don't install anything system-wide.
5. Grep `TODO` in the user's own folders and read `pipeline/NOTES_FOR_TEAM.md`. Summarise open items for them.
6. Suggest the next task for their role and offer to create branch `feat/devN-<task>`. Wait for their OK.
