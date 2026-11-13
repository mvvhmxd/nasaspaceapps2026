// Game values for the survival sim. Source: docs/features/survival-sim/design.md.
// These are game-balanced, NOT real lander numbers; label them "game values" in the UI.
export const SIM_CONFIG = {
  missionHours: 336, // 14 Earth days
  batteryCapacity: 100,
  chargeSunlit: 4, // units/h
  drainAwake: 1.5,
  drainAsleep: 0.4,
  extraDrainDrill: 1,
  extraDrainTransmit: 1,
  storeSize: 24, // packets
  lowBattery: [25, 10], // % thresholds that fire events
  starThresholds: [0.7, 0.9], // fraction of best score for 2 and 3 stars
};
