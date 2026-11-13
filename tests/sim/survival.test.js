import { describe, it } from 'vitest';

describe('survival', () => {
  it.todo('initialState returns a full battery from config');
  it.todo('advance steps 1 h at a time and never skips hours');
  it.todo('advance emits an event when the battery hits the minimum');
  it.todo('advance(…, 0, …) returns the state unchanged');
});
