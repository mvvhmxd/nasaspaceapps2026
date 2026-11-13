# Notes for the team (open decisions, mostly for Dev 1)

Dev 3 doesn't edit `src/data/loadSite.js`, the schema docs or `package.json`.
Changes needed there are listed here.

1. **`maskSource` field**: add a site-JSON field saying where the horizon mask
   came from (`"lola-dem"` vs `"demo"` / `"computeMask"`)? Proposed: string, required.
2. **Schema version**: add `schemaVersion` (int, start at 1) so `loadSite.js`
   can reject files it doesn't understand?
3. **Partial sun disc**: the Sun is ~0.53° wide. Should we treat it as sunlit
   when the centre is above the mask (current `visibility.js`), or export a
   0–1 visible fraction for solar power?
4. **Which 3 sites**: need picks with a citation for each (e.g. Artemis III candidate
   regions). `config/sites.yaml` has placeholders.
5. **Dates**: start UTC, length and step (1 h assumed) of the time series.
6. **YAML parser**: `config/sites.yaml` needs `pyyaml` in requirements. OK to
   add, or should it be JSON?
