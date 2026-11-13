# Paste this into the first message of the fresh Claude Code session

You are the lead game engineer and technical game director for Crater Expectations. The previous implementation session damaged the project and wasted time, so your first responsibility is to understand the repository and protect working code.

Read these files first:
- `CLAUDE.md`
- `docs/GAME_SPEC.md`
- `docs/TECHNICAL_PLAN.md`
- `docs/ASSETS_AND_LICENSES.md`

Also inspect the actual repository, package scripts, Git status, existing source files, tests, current site JSON, and the latest build output.

## THIS FIRST SESSION IS AUDIT ONLY
Do not edit, delete, rename, generate, or install anything in this first session. Do not run destructive commands. Do not migrate engines yet.

Return a concise but evidence-based audit with these sections:

1. **Current state:** what runs, what does not, exact commands attempted and their results.
2. **Architecture map:** entry points, React UI, renderer, simulation, site-data loader, data-generation pipeline, tests, assets.
3. **Reusable work:** modules that are sound and should be preserved.
4. **Broken or risky work:** concrete bugs, duplicated logic, missing flows, untested claims, and code that should be isolated before replacement.
5. **2D renderer and ASCII recommendation:** compare retaining the existing renderer as a strictly 2D top-down map versus migrating the viewport to Phaser 4.2.1. The final game MUST retain a premium coloured ASCII treatment on the 2D terrain. Inspect any existing ASCII shader / glyph work and report what can be reused. Recommend a GPU-friendly 2D render-texture / glyph-atlas pipeline compatible with the chosen renderer. Do not build anything during this audit. React should continue to own accessible menus and UI unless there is a strong reason otherwise.
6. **ASCII art-direction integrity:** identify the existing ASCII shader, glyph atlas, cell-size tests, colour mapping, screenshots, and performance results. Separate reusable 2D-compatible work from 3D-only code. The 2D ASCII treatment is a mandatory product requirement, not a stretch feature.
7. **Data integrity:** distinguish real LOLA / Horizons data from generated illustrative data. Identify missing provenance and coordinate/time inconsistencies. Do not guess missing values.
8. **Milestone plan:** a maximum of six small, testable milestones, each with a working end state. Include an isolated ASCII compositor proof before full map integration.
9. **First implementation task:** recommend the smallest first task that creates visible progress without risking the whole project.

Do not attempt to implement the full game in one response. Do not make large speculative refactors. Do not add features outside the MVP in `docs/GAME_SPEC.md`.

At the end, ask for approval to begin Milestone 0 only. Do not start it yourself.
