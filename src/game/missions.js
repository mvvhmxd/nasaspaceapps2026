// Mission definitions. Text and tuning only; the rules live in src/sim/.
import { SIM_CONFIG } from '../sim/config.js';

export const MISSIONS = [
  {
    id: 'first-light',
    name: 'FIRST LIGHT',
    teaches: 'Sunlight',
    siteIds: ['site-a'],
    config: { ...SIM_CONFIG, missionHours: 168 },
    slipDays: 0,
    brief: [
      'Land a small solar lander near the Moon’s south pole and keep it alive for 7 Earth days.',
      'The Sun charges the battery only when it clears the local ridge line. In shadow the battery drains.',
      'One site, one decision: pick the landing day with the most light.',
    ],
  },
  {
    id: 'call-home',
    name: 'CALL HOME',
    teaches: 'Earth contact',
    siteIds: ['site-a', 'site-b'],
    config: { ...SIM_CONFIG },
    slipDays: 0,
    brief: [
      'A 14-day science mission. Drilling collects data in sunlight, but data only scores once it reaches Earth.',
      'Earth must be above the local horizon to transmit. It rises and sets on its own rhythm, not the Sun’s.',
      'Two sites this time. Compare them: the sunniest site is not always the one that can call home.',
    ],
  },
  {
    id: 'long-shadow',
    name: 'THE LONG SHADOW',
    teaches: 'Launch slip',
    siteIds: ['site-a', 'site-b', 'site-c'],
    config: { ...SIM_CONFIG },
    slipDays: 5,
    replanSeconds: 60,
    brief: [
      'Three sites, 14 days, and a rocket that is not ready.',
      'After you lock your plan the launch will slip. The sky will have moved, and you get 60 seconds to replan.',
      'A good planner knows the second-best option before it is needed. Pin your alternatives.',
    ],
  },
];

export const missionById = (id) => MISSIONS.find((m) => m.id === id);
