import { periodPresetToRange } from '../insightPeriod';

const NOW = new Date('2026-09-01T12:00:00Z').getTime();
const DAY_MS = 86400000;

describe('periodPresetToRange', () => {
  it('"all" returns an empty range (full history)', () => {
    expect(periodPresetToRange('all', null, null, NOW)).toEqual({});
  });

  it('"last30" returns a from bound 30 days back, no to bound', () => {
    expect(periodPresetToRange('last30', null, null, NOW)).toEqual({ from: NOW - 30 * DAY_MS });
  });

  it('"last3Months" returns a from bound 90 days back', () => {
    expect(periodPresetToRange('last3Months', null, null, NOW)).toEqual({ from: NOW - 90 * DAY_MS });
  });

  it('"last6Months" returns a from bound 180 days back', () => {
    expect(periodPresetToRange('last6Months', null, null, NOW)).toEqual({ from: NOW - 180 * DAY_MS });
  });

  it('"custom" uses the provided dates, undefined when missing', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-02-01T00:00:00Z');
    expect(periodPresetToRange('custom', from, to, NOW)).toEqual({ from: from.getTime(), to: to.getTime() });
    expect(periodPresetToRange('custom', null, null, NOW)).toEqual({ from: undefined, to: undefined });
  });
});
