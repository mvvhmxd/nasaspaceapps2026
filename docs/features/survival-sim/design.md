# Survival sim

**Status:** designed · **Updated:** 2026-11-13 · [GDD](../../GDD.md)

After landing, time runs hour by hour through the mission window. The real Sun and Earth series decide when the lander charges and when it can talk to Earth. The player can't change the sky, only pause, fast-forward, sleep the lander and (with the task schedule) choose when to drill and transmit. Survival is the consequence of the plan, and the tension is watching a long shadow approach with the battery at 30%. Pillar: *Real sky, real stakes.*

## Rules
1. The sim steps in game hours. Each hour reads `sunlit` (Sun elevation above the site's horizon mask at the Sun's azimuth) and `earthVisible` (the same test for Earth) from the site JSON.
2. Battery changes each hour: `+charge` if sunlit; `−drain` always (`−sleepDrain` instead when asleep). It is clamped to 0..capacity.
3. The lander is in one mode at a time: **Awake** (normal drain), **Asleep** (low drain, no science, no comms), **Drilling** (extra drain, +1 science per hour, needs sunlit), **Transmitting** (extra drain, sends 1 data packet per hour, needs earthVisible).
4. Science counts only once transmitted. Drilling fills the data store and transmitting empties it to score. Data held when the battery dies is lost.
5. Battery reaching 0 = **power down**, and the mission is lost. Reaching the end of the mission window with battery > 0 = survived.
6. Events fire on state changes and feed the HUD and sound: sunrise, sunset, Earthrise, Earthset, battery < 25%, battery < 10%, power down, mission success. Each is fired once per crossing, never every frame.
7. The HUD always shows the battery %, the data store, the score, a countdown to the next sunset (or sunrise), and one to the next Earthset (or Earthrise).
8. Without the task schedule, the mode is automatic: drill when sunlit and the store isn't full, transmit when Earth is visible and the store isn't empty, sleep when dark. With the task schedule, the player's plan overrides this.
9. Score = transmitted packets. Stars come from the solver: 1 = survived, 2 = ≥ 70% of the best score for this mission, 3 = ≥ 90%. Without the solver, stars use fixed thresholds per mission.

## Numbers
| Name | Value | Unit | What to watch in playtests |
|---|---|---|---|
| Mission length | 14 [ASSUMPTION] | Earth days (336 h) | About half a lunar day: long enough for one deep shadow |
| Battery capacity | 100 | units | — |
| Charge when sunlit | +4 [ASSUMPTION] | units/h | Does a sunny site feel safe? |
| Drain awake | −1.5 [ASSUMPTION] | units/h | 66 h of darkness survivable awake |
| Drain asleep | −0.4 [ASSUMPTION] | units/h | 250 h asleep: sleep is a real decision |
| Extra drain drilling / transmitting | −1 / −1 [ASSUMPTION] | units/h | — |
| Data store size | 24 [ASSUMPTION] | packets | Forces transmits between drills |
| Time scale | 1 h per 0.5 s at 1×; 1×, 4×, 16× | — | Can a 336 h mission be watched in about 3 min? |

## Edge cases
- Fast-forward never skips events: the sim steps every hour and the HUD shows each event even at 16×.
- Pausing stops the sim but not the camera, so the player can look around.
- A launch slip during the survival phase is out of scope for MVP; slips happen before landing.
- Sunlit and dark at the same hour can't happen; the data gives one value per hour.

## Open questions
- [ASSUMPTION] All power numbers are game-balanced, not taken from a real lander. Label them "game values" in the How it works panel.
- Should a partly visible Sun (straddling the ridge) give partial charge? MVP: no; the test is on the Sun's centre.

## History
- 2026-11-13: designed.
