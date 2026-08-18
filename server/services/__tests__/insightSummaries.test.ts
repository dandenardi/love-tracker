jest.mock('../aiInsightProvider', () => ({
  AnthropicInsightProvider: jest.fn().mockImplementation(() => ({})),
}));

import { mapRowsToEventSummaries } from '../insightService';

describe('mapRowsToEventSummaries', () => {
  it('returns an empty array for no rows', () => {
    expect(mapRowsToEventSummaries([])).toEqual([]);
  });

  it('computes dayOffset as whole days since the earliest row, floored', () => {
    const dayMs = 86400000;
    const earliest = 1700000000000;
    const rows = [
      { client_id: 'a', type: 'DATE', intensity: 3, occurred_at: earliest },
      { client_id: 'b', type: 'DATE', intensity: 3, occurred_at: earliest + 3 * dayMs },
      { client_id: 'c', type: 'DATE', intensity: 3, occurred_at: earliest + 10 * dayMs },
      { client_id: 'd', type: 'DATE', intensity: 3, occurred_at: earliest + 90000000 }, // 1.04 days
    ];

    const result = mapRowsToEventSummaries(rows);

    expect(result.map((r) => r.dayOffset)).toEqual([0, 3, 10, 1]);
  });

  it('carries over optional fields only when present, omitting nulls', () => {
    const rows = [
      { client_id: 'a', type: 'DATE', intensity: 3, occurred_at: 1700000000000, mood_tag: null, contact_token: null },
      { client_id: 'b', type: 'DATE', intensity: 3, occurred_at: 1700000000000, mood_tag: 'happy', contact_token: 'tok-1' },
    ];

    const result = mapRowsToEventSummaries(rows);

    expect(result[0].moodTag).toBeUndefined();
    expect(result[0].contactToken).toBeUndefined();
    expect(result[1].moodTag).toBe('happy');
    expect(result[1].contactToken).toBe('tok-1');
  });
});
