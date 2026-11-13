---
name: simulation-engine
description: Implements and tests deterministic gameplay simulation. Use when changing power, visibility, task, communication, scoring, or mission state logic.
---

# Simulation Engineering Rules

- Simulation functions must be pure where practical and must not import React, Phaser, DOM, Canvas, or browser APIs.
- Put numerical tuning values in a single config module and identify them as gameplay assumptions.
- Use explicit units in names: `batteryWh`, `solarPowerW`, `durationHours`, `sunElevationDeg`.
- Test azimuth wraparound and horizon-mask interpolation, including boundary values.
- Derive Sun and Earth visibility independently by comparing each body's elevation with the terrain horizon at that body's azimuth.
- No direct Earth link means no transmission progress. Science stays buffered.
- Integrate power as Wh from W × hours. Clamp battery at zero and capacity.
- Ensure paused state cannot advance time or tasks.
- Make mission replay deterministic from the same input data and player commands.
- Do not embed gameplay formulas in React components or Phaser scenes.
