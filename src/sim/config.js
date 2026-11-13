// Tunable game constants. All values are TODO placeholders, not real figures.
export const SIM_CONFIG = Object.freeze({
  stepHours: 1, // sim always advances 1 h at a time
  batteryCapacityWh: null, // TODO
  solarPanelW: null, // TODO peak output in full sun
  loads: Object.freeze({
    survivalHeaterW: null, // TODO
    avionicsW: null, // TODO
    commsW: null, // TODO only when Earth is visible
  }),
  thresholds: Object.freeze({
    minStateOfCharge: null, // TODO fraction 0–1; below this = failure
    maxDarkHours: null, // TODO
  }),
});
