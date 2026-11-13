---
description: Start a work session. Set role (dev1-4), sync main, check tools, pick the next task.
---
1. **Role.** If not set, ask "dev1, dev2, dev3 or dev4?" (dev4: "supporting which?"). Show the card.
   An argument also works: `/start dev3`, `/start dev4 as dev2`.
2. **Sync.** `git status`. If dirty, show the changes and ask: stash, `/finish`, or leave.
   Otherwise `git switch main` and `git pull`.
3. **Open work.** List branches matching `*/devN-*` (dev4: `*/dev4-as-devN-*`).
   If `gh` works: `gh pr list --author @me`, and for dev1 also `gh pr list`. Otherwise say so.
4. **Tools** (report only, never install system-wide): Node 22 + npm for everyone; `node_modules/`
   present, otherwise offer `npm ci`. dev3 (or dev4 as dev3): Python 3.11+ and `pipeline/.venv`,
   otherwise offer to create it.
5. **Project state.** Read `docs/BUILD_STATUS.md` and report the current milestone and next task.
   Remind: one milestone at a time, M0 is audit-only.
6. **Role inbox.** Search for `TODO` in the role's owned paths. Read `pipeline/NOTES_FOR_TEAM.md`
   and the **Proposed** entries in `docs/DECISIONS.md`, and point out items waiting on this role.
7. **Next task.** Suggest one task that fits the current milestone, and why. Load the role's skill.
   Offer to create `<type>/devN-<task>` (dev4: `<type>/dev4-as-devN-<task>`) and wait for OK.
