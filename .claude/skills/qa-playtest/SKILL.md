---
name: qa-playtest
description: Runs structured functional, regression, and end-to-end game checks. Use after each milestone and before declaring a release candidate.
---

# QA and Playtest Workflow

For every milestone:
1. Run targeted unit tests.
2. Run the full test suite.
3. Run the production build.
4. Start the app and verify the changed flow in a real browser when browser tooling is available.
5. Check browser console and failed asset requests.
6. Test keyboard navigation and pause behavior.
7. Verify loading, empty, failure, and success states relevant to the change.
8. Record exact commands, results, and any unverified manual checks in `docs/BUILD_STATUS.md`.

Before final acceptance, play the campaign from a fresh browser profile through all three missions. Complete one successful run and intentionally trigger one failure. Confirm retry and campaign progression. Do not claim this happened if it was not performed.
