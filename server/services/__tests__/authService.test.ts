jest.mock('../../db/pool', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

import pool from '../../db/pool';
import { AuthService } from '../authService';

const mockQuery = pool.query as jest.Mock;

describe('AuthService.pair', () => {
  it('rejects an invalid or missing invite code', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(AuthService.pair('user-1', 'BADCODE')).rejects.toThrow(
      'Invalid or expired invite code'
    );
  });

  it('rejects an expired invite code', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'user-2', alias: 'Partner', invite_expires: Date.now() - 1000 }],
    });

    await expect(AuthService.pair('user-1', 'CODE123')).rejects.toThrow(
      'Invalid or expired invite code'
    );
  });

  it('rejects self-pairing without attempting to create a partnership', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'user-1', alias: 'Me', invite_expires: Date.now() + 10000 }],
    });

    await expect(AuthService.pair('user-1', 'CODE123')).rejects.toThrow(
      'You cannot pair with yourself'
    );
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('normalizes user_id_1/user_id_2 ordering when the caller id sorts lower', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'zzz-partner', alias: 'Partner', invite_expires: Date.now() + 10000 }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'partnership-1' }] })
      .mockResolvedValueOnce({ rows: [] });

    await AuthService.pair('aaa-caller', 'CODE123');

    const [, insertParams] = mockQuery.mock.calls[1];
    expect(insertParams[0]).toBe('aaa-caller');
    expect(insertParams[1]).toBe('zzz-partner');
  });

  it('normalizes user_id_1/user_id_2 ordering when the caller id sorts higher', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'aaa-partner', alias: 'Partner', invite_expires: Date.now() + 10000 }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'partnership-1' }] })
      .mockResolvedValueOnce({ rows: [] });

    await AuthService.pair('zzz-caller', 'CODE123');

    const [, insertParams] = mockQuery.mock.calls[1];
    expect(insertParams[0]).toBe('aaa-partner');
    expect(insertParams[1]).toBe('zzz-caller');
  });

  it('returns partnerId, partnerAlias and partnershipId on success', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'user-2', alias: 'Partner', invite_expires: Date.now() + 10000 }],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'partnership-1' }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await AuthService.pair('user-1', 'code123');

    expect(result).toEqual({
      partnerId: 'user-2',
      partnerAlias: 'Partner',
      partnershipId: 'partnership-1',
    });
    expect(mockQuery.mock.calls[0][1]).toEqual(['CODE123']);
  });
});
