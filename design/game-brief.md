# Game Brief: Crater Expectations

## In your words
Crater Expectations: an ASCII lunar south-pole mission sim. Fly a scout over a 2D top-down ASCII map of the real south pole; a 360° skyline strip shows the true Sun and Earth from wherever you hover, and ridges can hide them. Plant up to 3 flags to compare sites, time-warp to pick the landing hour, land, then walk to hab/survey/drill/dish stations: survey needs sunlight, transmit needs Earth above the ridge, drill pays more in the shadowed crater. An instrument bar shows sun elevation, time to sunset/Earthset and Earth visibility. Mission 3: the launch slips 12 hours, you go back to orbit and watch the sky move before you re-pick or hold. EVERYTHING IS ASCII: title logo, HUD, menus, gauges, dialogs, radio messages, transitions, end screens; box-drawing borders, no images or icons. ART IS A PRIORITY: high-detail ASCII on a canvas grid; terrain shaded with a long character-density ramp and hillshaded by the real sun direction; long real cast shadows at low sun; pitch-black shadowed crater with faint blue frost; limited palette (grey regolith, amber sun, blue/white Earth, phosphor-green UI, subtle CRT glow); detailed ASCII Earth disc showing its phase; sun glare when clipping a ridge; animated dish and panels, footprints, landing dust, transmit pulse. SOUND AND MUSIC via Web Audio synthesis, no files: no sound in vacuum, so audio comes through the suit/radio/structure (breathing, servo hum, radio static, telemetry beeps, landing thump, drill grind, transmit chirp, typewriter clicks); generative ambient music that follows the sky: warm drone in sunlight, cold sparse tones in shadow, a melodic home layer while Earth is visible, rising tension near sunset/Earthset; mute toggle. Optional raymarched ASCII first-person look mode later
1. Time: turn-based
2. Feel: a tense race against sunset and Earthset
3. Challenge: in between
4. Goal: score as much science as you can before you have to leave
5. Size: all three missions, kept short (about 5–8 minutes each), so the full arc and the 12-hour slip are in
6. Map: one hand-shaped site modelled on a real south-pole area, such as Shackleton's rim and Connecting Ridge, with placeholder Sun and Earth paths for now
After play: best: the music, the moon terrain interacting with map movement, the info and guide text boxes. Worst: the ascii lacks details, i want high resolution by fitting more ascii in the same space, and we want the player be able to see 3d, not moving on a map, like a pov
After play: [a dot-matrix Earthrise image from ascii.rest] make the sun similarly and use anything u need from ascii.rest · use similar approach to ascii.rest
After play: bigger sun, movement in 3d is glitchy not smooth and its slow and physics is a bit buggy, we also need to utilize music if hes in danger music changes to stress the player and hud and tips and status are good but it distracts the player and doesnt stress enough on him for him to care like they are not feeling the purpose of the game currently they just move to location and press keys · 1+2+3 (bring the crew home, outrun the shadow, read the world not the HUD), if possible can we make a moon rover for movement and enhance the graphics and assets more · we could add the rocket or whatever is landing cutscene with music and radio from nasa comms and take off cutscene · with music for both and utilize music in every aspect like danger music sun going down music no earth view or comm music and rover movement sound · the hud is still distracting and the player isnt paying attention to them we need a better positioning or utilization for them · if player got into map edges or want to leave the mission space put a background and 5s timer to return to mission area and dont forget the music · end if it runs out · keep the boxes visible
After play: enhance this asset and similar assets to it, this part seems confusing if judge or inexperienced person tries it they will take time to get whats intended make a numbered walkthrough at first of starting the game that shows them around th ui and controls and what they should pick in a landing site and what the numbers tells etc, show the rocket thats landing and taking off not a fpv
After play: do the real data , 1 , 2 , emphasis on the score and kpi · [Earth half lit] is the earth not fully visible normal? and in mission one its completely invisible · the game became hard to play because of the terrain the old not data based one was easier but very hard can we make up our way and still claim scientific data but put it in between as before and afetr data (chose: both; stations too far) · do start the scout somewhere less ideal so the planner has something to teach. make it hard progressively in missions
After play: lunar landing site navigation · do 1,2 (planner mode from the title, validation screen) · bring baack the earth details · add walkthru guide to the planner mode · can you add a voice saying the radio comments of lmp cdr etc and it to be with static and it sounds like out of walkie talkie gear · radio chatter dont match the written text its broken also they overlap each other and it sounds robotic and theres female voice overtalks the female voice · this line okay? (screenshot: the ridge line cutting across the landing lander) · theres freezing and pauses in the cut scene of landing and theres no take off cutscene · increase the time for out of mission area to 10s from 5s · im still getting lost navigating to drill or survey or to the dish or ship when i face it · they also too small and not easily visible · validate the numbers
After play: make survey and dish and similar assets bigger and fix graphics glitches in everything if you could increase reolution it would be better · in addition to this add the 3d ship landing and the repo and lethal company additions · after you are done run final submission polish and ensure everything pushed to github and its live on github pages
After play: So , i wanna the landing animation doesnt crash at the end it is hard to land it

**Pitch:** Scout the Moon's south pole from orbit, land where the ridges let the Sun and Earth through, and race the horizon to get your science home.

**Genre:** ASCII mission sim: orbital scouting, then a real-time rover drive against the clock *(after play)*

**Controls:** Orbit: arrows/WASD move the scout, F plants a flag, [ ] scrub time, Enter lands; V shows the ground view from the scout (Q/E turn). Surface, in the rover: W/S throttle and brake, A/D steer, E (or Space) works the station you are parked at, Z waits an hour, hold Tab (or toggle V) for the full instruments, Enter twice at the lander launches early; Q pings the scanner for buried ice. Landing *(after play)*: ↑ throttle, ← → tilt, Tab hands it to the autopilot (costs points). Enter skips cutscenes. H shows the walkthrough again. M mutes, Esc pauses.

**Question:** Is racing a sky that the terrain hides tense and readable, and does scouting from orbit make the landing choice feel like yours?

**Hooks:** The horizon is the obstacle: the Sun and Earth can be "up" and still hidden by a ridge; work only counts when the local skyline lets them through.

**Intent:**

## Look and references
- Look: everything ASCII on a canvas character grid in one crisp monospace font. Terrain shaded with a long character-density ramp, hillshaded by the current sun azimuth/elevation, with long real cast shadows at low sun; pitch-black shadowed crater with faint blue `·` frost. Limited palette: 5–6 greys for regolith, amber/white for the Sun and lit faces, blue/white Earth, phosphor-green UI, black star field, subtle CRT glow and scanlines. Box-drawing borders, gauges as `[████░░]`, hand-made ASCII title logo. Signature detail: a detailed ASCII Earth disc showing its phase hanging over the skyline strip, and sun glare streaks when the Sun clips a ridge. Animated dish and panels tracking Earth and Sun, footprints, landing dust, transmit pulse. Every figure drawn in characters: no images, no emoji, no plain circles.
- Data (after play): terrain from NASA LRO LOLA (smoothed for play, said on screen) and JPL Horizons Sun/Earth, credited on the title and the debrief; rover, power and score numbers stay a game model.
- References: the real lunar south pole (Shackleton rim, Connecting Ridge, the low sun) *(guessed)*; classic roguelike ASCII readability *(guessed)*.
- Dot-matrix detail (after play): terrain, Sun and Earth drawn as a dense grid of dots (. · ∙ • ●), 8 per text cell, whose size and colour carry the light, in the manner of ascii.rest's dot pieces, generated by the game's own renderer (no art copied, nothing loaded from the web). Text stays on the readable grid. Sun: a limb-darkened dot disc with a corona and rays; Earth: a phased dot disc with oceans, land and cloud; shadowed ground faintly earthlit blue.
- In-world HUD (after play): the visor fills the screen; SUNSET/EARTHSET clocks hang under the Sun and Earth on the horizon (edge arrows when off-screen); battery shows as frost creeping over the visor and a red edge pulse; radio lines fade in as subtitles; one objective line with a ◆ marker in the world; a slim dashboard on the rover's cowl. The map, status and radio boxes stay visible beside it, slimmer; the 360° strip, big map and Earth panel come up on Tab. Leaving the mission area turns the sky to red static with a big countdown.
- Assets (after play): dot-matrix sprites for the lander, solar array, dish, survey beacons, drill rigs and flags, sized by distance and hidden by nearer ground; the rover's cowl, fenders and antenna in view, riding the suspension; ridge outlines and earthshine contour lines so shapes read in the dark; a bigger Sun (sun_size). Iteration 3: more detailed sprites (beacon with sensor head, lens and blinking light on a tripod; lander with gold foil, windows and legs; drill rigs, dish, panels, rover), and cutscenes filmed from outside so you see the lander come down and the ascent stage leave.
- View: 3D first person on the surface, top-down map in orbit · Camera: a ray-marched visor view (vertical ×3 exaggeration, marked on screen) with a minimap, a 360° skyline strip above; in orbit a top-down map with a ground view on V.

## First minute
The title logo types itself in with typewriter clicks and radio static. Mission 1 opens in orbit over the site: the skyline strip shows the Sun sitting just above a ridge, and the hint reads "Move the scout. Watch the sky." Moving one way, the Sun sinks behind a ridge and the map's shadows swing; the other way, it clears. The player plants a flag where the Sun is clear and presses Enter. Landing dust, a thump, the hab appears. They step to the survey station and press E: science ticks up while the instrument bar shows SUN VISIBLE. A few turns later the Sun's track nears a ridge shoulder, the bar turns amber, "SUNSET 6h", and the music thins and turns cold. The ridge, not the clock, is what ends the day.

## Challenge
Difficulty climbs (after play): each mission starts the scout over a deliberately imperfect real site (M1 half-lit, M2 losing Earth after a day, M3 a dark hollow), with less battery (100/85/70%), a hungrier rover (drain x1.0/1.15/1.3) and a higher science target (60/100/140). Mission 1 is gentle: one sunset around minute 3, and enough battery to wait it out at the array. Mission 2 adds Earthset: science you collected but have not transmitted is worth nothing until you send it before Earth slips behind the ridge. Mission 3 is the full trade-off: the shadowed terrace pays most but drains the battery in the cold, and a 12-hour launch slip moves the whole sky. If the battery hits zero, the mission ends early and you keep only what was transmitted. Each mission ends at its departure time. *(provisional, from "in between")*

## Core loop
- From orbit: scout the site, compare flags by their skies, pick the landing spot and hour.
- On the surface: walk to a station (each step costs time and power) and work it while its condition holds: Sun for survey, battery reserve for the drill, Earth for the dish.
- Bank science by transmitting while Earth is clear; recharge at the array or wait out the dark.
- At departure, score the science that made it home; next mission or retry.

## Goal & fail state
- Score as much as you can on each mission's KPIs: science sent home, crew home, a sunlit lander, a dish that sees Earth, battery margin; minus science left unsent. The debrief grades each KPI against its target, totals the campaign and rates it (Horizon Reader, Mission Planner, Flight Director).
- Bring the crew home: be back at the lander (within board_radius) when the ascent window comes, or the lander leaves without you and the mission is lost (stranded).
- Stay inside the mission area: outside it, Houston gives you oob_seconds to turn back before calling the abort.
- If the battery hits zero, the mission ends early and only science already transmitted counts; the mission can be retried.

## Features
- [x] Orbit scout: ASCII map of the site, a live 360° skyline from the scout's position, up to 3 flags with each site's sunlit % and Earth visibility, time scrub to preview the sky, then land.
- [x] Horizon sky model: real Sun and Earth tracks (Horizons, after play) (low Sun circling, Earth wobbling) occluded by the heightmap horizon; instrument bar with sun elevation, time to sunset/Earthset, Earth visibility.
- [x] Turn-based surface: steps and work cost mission time; five stations: hab, solar array (low-power wait), survey (needs Sun), drill (needs battery reserve, pays more in the shadowed crater), dish (needs Earth); battery drains in the dark and cold.
- [x] Three short missions: learn the horizon, get science home, the trade-off; Mission 3's 12-hour launch slip sends you back to orbit to re-pick or hold; radio messages from mission control.
- [x] ASCII art pass: hillshade, cast shadows, crater frost, phased Earth disc, sun glare, animated dish and panels, footprints, landing dust, transmit pulse, CRT glow, ASCII title, HUD and end screens.
- [x] First-person visor (after play): a ray-marched dot-matrix view of the heightfield with real cast shadows, the Sun and Earth cut by the ridge, stations and lander with distances, compass, minimap; ground view from the scout in orbit; denser dot-matrix map, skyline strip and Earth.
- [x] Synthesized sound and generative music that follow the sky (warm in Sun, cold in shadow, home layer while Earth is visible, tension near set); mute toggle. After play: dusk music as the Sun nears the ridge, a hollow no-Earth/no-comms layer, a link-back cue, a heartbeat danger layer for low battery and a late ascent, an out-of-bounds alarm, rover motor, gravel and steering sounds, and landing/launch themes. After play: CAPCOM, CDR and LMP speak their radio lines (the computer's offline voices, each with its own pitch), over walkie-talkie static with a key-up click and a squelch tail. Spoken radio: CAPCOM (Mark), CDR (David) and LMP (Zira) lines recorded once from Windows offline voices through a walkie-talkie filter, played one call at a time on one channel; each subtitle appears when its call starts and types at its pace; cutscenes wait for the crew.
- [x] The rover and the running clock (after play): drive the surface in real time with smooth physics (throttle, steering, slopes that slow you and stop you when too steep, suspension bumps, pitch and roll); landing and ascent cutscenes with NASA-style comms (Quindar tones); the HUD moved into the world; the out-of-bounds countdown.
- [x] Real NASA data (after play): the site is Connecting Ridge (an Artemis III candidate region) from LRO LOLA laser altimetry (40 m and 240 m polar DEMs), with lunar curvature; the Sun and Earth follow JPL Horizons positions for each mission's real 2027 date; permanently shadowed cells come from a whole year of real Sun positions. Baked into one offline file. After play: the heights are blended halfway toward a 0.5 km smoothed copy so the rover can drive it (terrain_smooth, 0 = raw data), and the credits say so; the stations sit within about 3.5 km of a ridge-top start zone, with a real shadowed hollow for the cold-trap drill.
- [x] KPI score and site debrief (after play): each mission is graded A-F on six KPIs (science sent, crew home, lander sunlit %, dish Earth %, lowest battery, science left unsent) against targets, with points, a big mission score, the campaign total and a rating; the debrief compares your landing site's Sun/Earth timeline with the planner's pick among about 1000 landable sites and says why it is better.
- [x] Numbered walkthrough (after play): on the first mission, 7 steps in orbit and 6 after touchdown light one part of the screen at a time and explain the controls, what the live numbers mean and what makes a good landing site; H shows it again.
- [x] Planner Mode and Validation (after play, for the Lunar Landing Site Navigator challenge): P on the title opens a planner on any hour of 2027 (hour, day and week steps, window 24 h to 708 h, time-lapse), named published sites, typed latitude/longitude limited to the baked map, up to 3 sites compared with Sun %, Earth %, Sun clearance and next sunset/Earthset, a slip test (+1 d, +3 d, +7 d) and a best-sites heat map; V opens a validation screen that recomputes sunlight at 4 published sites (Gläser et al. 2017), Sun and Earth elevations against independent JPL Horizons topocentric queries, and the Shackleton floor shadow check, with method and limits. The Earth's night side is drawn with its continents, seas and clouds at mid brightness (labelled as boosted), so a near-new Earth still reads. A 7-step walkthrough opens the first time Planner Mode does (H replays it).
- [x] Flown landing and hazards (after play): the last 260 m of the descent are yours in a chase-cam 3D view over the real LOLA ground and the real Sun angle (throttle, tilt, fuel; touch down under 2 m/s, 8° tilt and 1.5 m/s sideways on a slope under 15°; beacons float round the pad; a shadowed pad has only the landing lights; Tab autopilot costs points; a free landing assist brakes a fall you could not stop and steadies her in the last 15 m, and a touchdown outside the limits is a hard landing with no landing points, not a lost mission); the ascent gets a climbing chase cam; fragile cargo cracks on hard bumps (ice worst); missions 2 and 3 may bring a solar storm (flare warning, then protons: shelter at the lander or take a dose); in permanent shadow the headlights and a Q scanner ping find hidden ice, and the cold drains faster. Stations are bigger and more detailed, the map draws them as ASCII icons, and every view has 3×6 dots per character. Storm, cargo and lander physics are a game model.

## Your systems
- scouting from orbit with flags and time-warp · in the slice
- 360° skyline and horizon occlusion of the Sun and Earth · in the slice
- power and battery · in the slice
- science: survey, drill, transmit · in the slice
- three missions and the 12-hour launch slip · in the slice
- generative music and synthesized sound · in the slice
- raymarched ASCII first-person visor view · in the slice
- rover driving physics and the real-time mission clock · in the slice
- landing and ascent cutscenes with radio comms · in the slice
- in-world HUD and mission-area bounds · in the slice
- numbered walkthrough · in the slice
- real LOLA terrain and JPL Horizons ephemeris · in the slice
- KPI score and site debrief with the planner's pick · in the slice

## Keep
- the music *(you said)* · pins: music_volume 0.55
- the moon terrain interacting with map movement: the skyline and shadows change as you move *(you said)*
- the info and guide text boxes (briefings, radio, instrument bar) *(you said)*

## Avoid
- Images or icons: everything is ASCII.
- A dashboard of numbers as the main experience: the navigator is played in the world.
- Sound "in space": all audio comes through the suit, radio or structure.

## Out of scope
- More than one site region, custom lat/lon: grow it

## Build order
1. The slice: all three missions, short, end to end: orbit scout → land → turn-based stations under the occluding skyline → transmit → departure score, with Mission 3's slip, battery failure and a results screen.
2. The art pass on the map, sky and Earth disc.
3. Sound and generative music.

---
**Kill condition:** if, after two tuning rounds, players cannot tell why the Sun or Earth disappeared. *(guessed)*

**Who it's for / what they feel:** Space Apps judges, students and the public; they feel the low south-pole sky as a real opponent and see why a few kilometres or hours matter. *(guessed)*

**Games you love / don't:**
