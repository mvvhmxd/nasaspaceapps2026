---
description: Finish work. Test, build, check ownership and data, commit, push, open a draft PR.
---
Stop if a step fails. Never commit, push or open a PR without the user's OK.
1. **Role.** If unknown, ask (dev1–dev4).
2. **Checks.** `npm test` and `npm run build` for everyone. dev3 also runs pytest in `pipeline/` with
   `pipeline/.venv`. If UI or the map changed: run the app and check the changed flow in a browser
   (`qa-playtest` skill). Never skip or disable a test.
3. **Ownership.** Compare `git status` and `git diff --name-only main...HEAD` with `CLAUDE.md`.
   Files from another role: warn and name the owner. Shared files: needs owner + dev1, goes under
   "Reviewer must decide".
4. **Data and assets.** Refuse kernels, DEMs, `data/raw/`, `.venv/`, `node_modules/`. Any new asset
   must be listed with its license in `docs/ASSETS_AND_LICENSES.md` and the credits file.
5. **Docs.** If a milestone item changed, update `docs/BUILD_STATUS.md` (commands run, results,
   next task). Record architecture choices in `docs/DECISIONS.md`.
6. **AI-use log.** Add one line (`date – tool – what it did – what you reviewed`) to the right log.
   The user confirms the "reviewed" part.
7. **Commit.** List files, stage them by name (never `git add -A`), propose a conventional message.
   Use the user's git identity, with no AI co-author lines. Wait for OK.
8. **Push + draft PR.** `git push -u origin <branch>`. With `gh`: `gh pr create --draft`, reviewer =
   owner (dev4) and dev1. Body: What / Files changed / Milestone / Reviewer must decide / Tests and
   build / Browser check. Without `gh`: print the title, body and compare URL. Never merge.
