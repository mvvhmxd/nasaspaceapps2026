# Site planner

**Status:** designed · **Updated:** 2026-11-13 · [GDD](../../GDD.md)

Before landing, the player picks *where* and *when*. A south pole map shows the mission's candidate sites; a date strip shows the launch window. Every site-and-date choice instantly previews what that choice means for power and comms, and up to 3 choices can sit side by side. This is the challenge's "compare sites and dates quickly" made into the game's main decision. Pillar: *Decide, then live with it.*

## Rules
1. The map shows the mission's sites (3 in MVP) as markers on the top-down terrain. Clicking one selects it.
2. The date strip covers the mission's launch window, one cell per Earth day. Each cell is tinted by how good that day is for the selected site: amber for sunlit hours, with a teal underline for Earth-visible hours.
3. Selecting a site + date shows a preview card, all computed from the site's hourly series over the mission length starting at that date:
   - sunlit hours (% of mission)
   - Earth-visible hours (%)
   - longest continuous darkness (h)
   - Sun elevation at landing (°)
   - time from landing to the first sunset and the first Earthset (h)
4. "Pin" saves the current choice to a comparison tray (max 3). The tray shows the preview cards side by side, with the best value in each row highlighted.
5. A warning icon appears if the longest darkness exceeds what the battery can survive asleep (from [survival sim](../survival-sim/design.md)). It does not block the choice; dying is allowed.
6. "Land" locks the choice and starts the survival phase. After a launch slip, the planner reopens with the new earliest date pre-selected and a 60 s countdown; if it runs out, the slipped date at the same site is used.
7. Planner view toggle: shows the same preview as raw numbers plus a Sun/Earth elevation chart over the mission, for expert users.

## Numbers
| Name | Value | Unit | What to watch in playtests |
|---|---|---|---|
| Sites per mission | 3 | sites | Enough contrast between sites? |
| Launch window length | 30 [ASSUMPTION] | Earth days | One lunar day, so every lighting phase appears |
| Comparison tray size | 3 | choices | Do players use it at all? |
| Replan countdown after slip | 60 [ASSUMPTION] | s | Tense or just stressful? |

## Edge cases
- A date whose mission window runs past the end of the precomputed data is greyed out.
- Pinning the same site + date twice does nothing.
- Custom coordinates are out of scope for MVP (no precomputed data); shown as "coming soon" in planner view.

## Open questions
- [ASSUMPTION] Which 3 sites: candidates are the Shackleton–de Gerlache connecting ridge, a de Gerlache rim site, and one that looks good but hides a long-shadow trap. Coordinates still need to be taken from Moon Trek or the literature.
- [ASSUMPTION] Launch window dates (2027?) depend on the range of Horizons data the pipeline pulls.

## History
- 2026-11-13: designed.
