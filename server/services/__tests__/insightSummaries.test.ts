jest.mock('../aiInsightProvider', () => ({
  AnthropicInsightProvider: jest.fn().mockImplementation(() => ({})),
}));

import { mapRowsToEventSummaries, countQualifyingRelationships } from '../insightService';

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

  it('carries relationship_id through to relationshipId (spec 008)', () => {
    const rows = [
      { client_id: 'a', type: 'FIGHT', intensity: 4, occurred_at: 1700000000000, relationship_id: 'hash-1' },
      { client_id: 'b', type: 'FIGHT', intensity: 4, occurred_at: 1700000000000, relationship_id: null },
    ];

    const result = mapRowsToEventSummaries(rows);

    expect(result[0].relationshipId).toBe('hash-1');
    expect(result[1].relationshipId).toBeUndefined();
  });
});

describe('countQualifyingRelationships', () => {
  it('returns 0 for an empty list', () => {
    expect(countQualifyingRelationships([], 3)).toBe(0);
  });

  it('only counts relationships meeting the minimum event count', () => {
    const rows = [
      { relationship_id: 'r1' },
      { relationship_id: 'r1' },
      { relationship_id: 'r1' }, // r1: 3 events, qualifies at threshold 3
      { relationship_id: 'r2' },
      { relationship_id: 'r2' }, // r2: 2 events, does not qualify
      { relationship_id: 'r3' },
      { relationship_id: 'r3' },
      { relationship_id: 'r3' },
      { relationship_id: 'r3' }, // r3: 4 events, qualifies
    ];

    expect(countQualifyingRelationships(rows, 3)).toBe(2);
  });

  it('ignores rows with no relationship_id', () => {
    const rows = [{ relationship_id: null }, { relationship_id: undefined }, { relationship_id: 'r1' }];

    expect(countQualifyingRelationships(rows, 1)).toBe(1);
  });
});
