// Mission definitions. Text and tuning only; rules live in src/sim/.
export const MISSIONS = [
  {
    id: 'first-light',
    name: 'FIRST LIGHT',
    siteId: 'demo',
    slipDays: 5, // launch delay applied once, after the first plan is locked
    replanSeconds: 60,
    brief: [
      'Land a small solar lander near the Moon’s south pole and keep it alive for 14 Earth days.',
      'The Sun charges the battery only when it clears the local ridge line. Earth must be above the horizon to send science home.',
      'Pick the landing day. Drilling collects data in sunlight; data only scores once it is transmitted.',
    ],
  },
];
