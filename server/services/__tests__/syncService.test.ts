jest.mock('../../db/pool', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));
jest.mock('../authService', () => ({
  AuthService: { getPartnerships: jest.fn() },
}));

import pool from '../../db/pool';
import { AuthService } from '../authService';
import { SyncService } from '../syncService';

const mockQuery = pool.query as jest.Mock;
const mockGetPartnerships = AuthService.getPartnerships as jest.Mock;

describe('SyncService.pullEvents', () => {
  it('returns own events but no shared events/deletions when the user has no active partnership', async () => {
    mockGetPartnerships.mockResolvedValueOnce([
      { id: 'p1', alias: 'Ex', partnershipId: 'partnership-1', status: 'unpaired' },
    ]);
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // own events
      .mockResolvedValueOnce({ rows: [] }); // own deleted

    const result = await SyncService.pullEvents('user-1', 0);

    expect(result.events).toEqual([]);
    expect(result.deletedIds).toEqual([]);
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('keeps the is_private = 0 predicate and active-partnership/own-exclusion filters on the shared-events query', async () => {
    mockGetPartnerships.mockResolvedValueOnce([
      { id: 'p1', alias: 'Partner', partnershipId: 'partnership-1', status: 'active' },
    ]);
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // own events
      .mockResolvedValueOnce({ rows: [] }) // own deleted
      .mockResolvedValueOnce({ rows: [] }) // shared events
      .mockResolvedValueOnce({ rows: [] }); // shared deleted

    await SyncService.pullEvents('user-1', 1000);

    const [sharedEventsSql, sharedEventsParams] = mockQuery.mock.calls[2];
    expect(sharedEventsSql).toContain('e.is_private = 0');
    expect(sharedEventsSql).toContain('e.user_id != $2');
    expect(sharedEventsParams).toEqual([['partnership-1'], 'user-1', 1000]);
  });

  it('maps own and shared rows into the response shape, coercing occurred_at/logged_at to numbers', async () => {
    mockGetPartnerships.mockResolvedValueOnce([
      { id: 'p1', alias: 'Partner', partnershipId: 'partnership-1', status: 'active' },
    ]);
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            client_id: 'own-1',
            partnership_id: null,
            is_private: 1,
            type: 'AFFECTION',
            intensity: 3,
            occurred_at: '1700000000000',
            logged_at: '1700000000000',
          },
        ],
      }) // own events
      .mockResolvedValueOnce({ rows: [] }) // own deleted
      .mockResolvedValueOnce({
        rows: [
          {
            client_id: 'shared-1',
            partnership_id: 'partnership-1',
            is_private: 0,
            sender_id: 'user-2',
            type: 'DATE',
            intensity: 5,
            occurred_at: '1700000100000',
            logged_at: '1700000100000',
          },
        ],
      }) // shared events
      .mockResolvedValueOnce({ rows: [] }); // shared deleted

    const result = await SyncService.pullEvents('user-1', 0);

    expect(result.ownEvents[0]).toMatchObject({
      clientId: 'own-1',
      occurred_at: 1700000000000,
      logged_at: 1700000000000,
    });
    expect(result.events[0]).toMatchObject({
      clientId: 'shared-1',
      partnerId: 'user-2',
      occurred_at: 1700000100000,
      logged_at: 1700000100000,
    });
  });
});
