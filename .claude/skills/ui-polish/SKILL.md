---
name: ui-polish
description: Builds readable, accessible, polished React game screens and HUD. Use when implementing menus, planner, schedule, overlays, transitions, or settings.
---

# UI and Game Feel Workflow

- Follow the screen flow in `docs/GAME_SPEC.md`.
- React owns accessible menus, panels, settings, HUD, briefings, and debriefs. The 2D engine owns map-world drawing and interactions inside its viewport.
- Establish reusable design tokens before styling individual screens.
- Every visible control must have a real action, a disabled reason, or be removed.
- Use clear hierarchy: mission state first, next decision second, supporting data third.
- Pair colour with text and icons. Ensure keyboard focus and high contrast.
- Respect reduced motion; do not animate constantly.
- Every async load needs loading, error, and retry states.
- Use real game state, not hardcoded sample values, in final UI.
- Check layouts at 1366×768 and 1920×1080.
- Do not use generic stock space art to obscure missing lunar terrain.
- Keep the terrain ASCII effect behind the interface: HUD, labels, small icons, menus, and accessible text must remain crisp and never pass through the glyph compositor.
- Verify the default ASCII state, quality selector, and conventional-shading fallback are visible and functional.
