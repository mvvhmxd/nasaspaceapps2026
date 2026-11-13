# Architecture and Product Decisions

## D-001: 2D top-down is the target
- Status: Approved product direction.
- Reason: the map, site comparison, shadow visibility, and resource strategy are more readable in a north-up 2D view.

## D-002: Phaser 4.2.1 is the preferred 2D renderer candidate
- Status: Proposed, pending repository audit.
- Reason: a purpose-built 2D engine provides map camera, input, sprite, tween, and scene support.
- Constraint: no blind migration. Preserve pure simulation modules and avoid two renderers drawing the same gameplay view.

## D-003: React owns accessible game UI
- Status: Proposed.
- Reason: menus, settings, briefings, HUD and debriefs benefit from semantic DOM controls, keyboard accessibility, and ordinary React layout.

## D-004: simulation is the source of truth
- Status: Required.
- Reason: gameplay, HUD and rendering must agree on visibility, power, operations, communications and mission outcomes.

## D-005: three-mission campaign before rover stretch feature
- Status: Required scope rule.
- Reason: a complete campaign is more valuable than many incomplete mechanics.

## D-006: 3D surface presentation is superseded, 2D ASCII identity is retained
- Status: Approved.
- Scope: remove the old 3D hero camera and 3D surface viewer from active requirements. Keep a high-quality coloured ASCII treatment over the 2D top-down terrain as a mandatory visual identity.
- Reason: the team wants a readable strategy map without losing the distinctive ASCII art direction.
- Rule: ASCII applies to terrain / hillshade / contour imagery only. HUD, text, lander, and critical markers remain crisp overlays. The shader is presentation only and never calculates scientific truth.

## D-007: 2D ASCII terrain compositor
- Status: Required, implementation subject to renderer proof.
- Scope: GPU-friendly glyph-atlas compositing for planner and mission maps, on by default, with quality presets and an Off fallback.
- Reason: preserve the game's visual identity while moving away from a 3D scene.
- Rule: prototype and profile a small representative map before adopting or migrating rendering engines.

## D-008: keep the data pipeline in `pipeline/`
- Status: Proposed (dev3), needs dev1.
- Reason: the pipeline was already scaffolded in `pipeline/` (Python, own venv, tests). `docs/TECHNICAL_PLAN.md` §3 suggests `scripts/data-pipeline/`; read that as `pipeline/`.

## D-009: adopt the kit's simulation API
- Status: Proposed (dev3), needs dev1 and dev2.
- Scope: replace the earlier `survival.js` `advance()` / `planner.js` stubs with `createInitialState`, `stepMission(state, input, site, missionConfig)` (exactly one hour) and split modules (`solarPower.js`, `battery.js`, `operations.js`, `communications.js`, `mission.js`), as in `docs/TECHNICAL_PLAN.md` §3–5. Keep a `previewStats` helper for the planner.
- Migration: a separate dev3 PR; `horizon.js` and `visibility.js` are kept.

## D-010: mark the 3D-era docs as superseded
- Status: Proposed, needs dev1.
- Scope: `docs/GDD.md`, `docs/ARCHITECTURE.md`, `docs/features/surface-view/*` describe the retired 3D camera. Add a "Superseded by GAME_SPEC / TECHNICAL_PLAN" note at the top instead of deleting them, until M0's audit decides what to reuse.
