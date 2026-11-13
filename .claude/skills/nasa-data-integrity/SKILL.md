---
name: nasa-data-integrity
description: Validates lunar data provenance, coordinate conventions, ephemerides, and claims. Use when importing or changing LOLA or JPL Horizons data.
---

# NASA Data Integrity Workflow

For every dataset:
1. Identify the original dataset, product ID, source institution, product version, retrieval date, coordinate system, projection, datum, units, and resolution.
2. Preserve original query parameters, including JPL Horizons target, observer location, time range, time step, reference frame, and output quantities.
3. Verify array lengths, timestamps, angular units, coordinate direction, and azimuth conventions.
4. Verify the lunar site observer is defined correctly. A geocentric or Moon-centre observer is not interchangeable with a surface observer.
5. Test a sample of results independently against the source tool / documentation.
6. Keep real-data and illustrative-data paths distinct in code and UI.
7. A missing value is an error or explicit unknown, never an invitation to invent a plausible number.
8. Document simplifications in the in-game science guide.
9. Never imply NASA endorsement or certification.
