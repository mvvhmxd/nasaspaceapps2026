# Hackathon plan

Jam: NASA Space Apps Challenge 2026, Cairo local event · https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/
Dates: 14-15 Nov 2026 · Deadline: end time of the Cairo Local Event, **not known yet (ask the Local Lead)** · Cairo time = UTC+2
Upload lock: unknown (check the Project Submission Guide)

Rules: team 1-6 people | AI allowed, **submission must describe how AI was used** | submit on the team's project page on spaceappschallenge.org | NASA data use is judged (Relevance) | all links must be accessible
Judging: Impact, Creativity, Validity, Relevance, Presentation (see `judging.md`)

Concept: You choose where and when to land at the lunar south pole, then keep your lander alive on sunlight and Earth contact, while launch delays force you to replan.

MVP: site planner, survival sim, 3D surface view (ASCII), launch slip, debrief with Horizons check, missions 1-2, 3 sites. Design in `docs/GDD.md`.
Stretch (in cut order, cut from the top): planner mode → audio → rover trip → mission 3 → solver (use fixed star thresholds) → task schedule (use auto mode) → hero camera
Never cut: real data for at least 1 site, and the Horizons check.

## Timeline (H0 = event start)
- H0-2: lock the concept, pick the 3 sites, scaffold Vite + three.js, deploy an empty page once.
- H2-8: **M1** scene proof (real terrain + moving Sun, 1 site), with the data pipeline built in parallel.
- H8-12: sleep.
- H12-24: **M2** grey loop: planner → survival → slip → debrief, 3 sites.
- H24-30: sleep; 3+ people outside the team play it (and take the before/after quiz).
- H30-38: **M3** ASCII shader, colours, cameras, missions 1-2, juice.
- H38-44: feature freeze, fix crashes only; demo script; slides.
- H44-48: **M4** deploy, test the link in a private window, write the submission, AI-use note, **SUBMIT by about H46**.

## Cut log
