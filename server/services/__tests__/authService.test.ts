jest.mock('../../db/pool', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock('../emailService', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

import pool from '../../db/pool';
import { AuthService } from '../authService';
import { sendPasswordResetEmail } from '../emailService';

const mockQuery = pool.query as jest.Mock;
const mockSendPasswordResetEmail = sendPasswordResetEmail as jest.Mock;

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

describe('AuthService.requestPasswordReset', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockSendPasswordResetEmail.mockClear();
  });

  it('does nothing when the email does not exist (avoids enumeration)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await AuthService.requestPasswordReset('nobody@test.local');

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('invalidates prior tokens, inserts a new one, and sends the email for an existing user', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-1', email: 'alice@test.local' }] }) // SELECT user
      .mockResolvedValueOnce({ rows: [] }) // DELETE prior tokens
      .mockResolvedValueOnce({ rows: [] }); // INSERT new token

    await AuthService.requestPasswordReset('Alice@Test.Local');

    expect(mockQuery.mock.calls[0][1]).toEqual(['alice@test.local']);
    expect(mockQuery.mock.calls[1][0]).toMatch(/DELETE FROM password_reset_tokens/);
    expect(mockQuery.mock.calls[1][1]).toEqual(['user-1']);
    expect(mockQuery.mock.calls[2][0]).toMatch(/INSERT INTO password_reset_tokens/);
    expect(mockQuery.mock.calls[2][1][0]).toBe('user-1');

    expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const [to, resetUrl] = mockSendPasswordResetEmail.mock.calls[0];
    expect(to).toBe('alice@test.local');
    expect(resetUrl).toContain('/auth/reset-password?token=');
  });
});

describe('AuthService.resetPassword', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('rejects a nonexistent token', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(AuthService.resetPassword('bad-token', 'newpassword123')).rejects.toThrow(
      'Invalid or expired reset link'
    );
  });

  it('rejects an already-used token', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'token-1', user_id: 'user-1', expires_at: Date.now() + 10000, used_at: Date.now() - 1000 }],
    });

    await expect(AuthService.resetPassword('used-token', 'newpassword123')).rejects.toThrow(
      'Invalid or expired reset link'
    );
  });

  it('rejects an expired token', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'token-1', user_id: 'user-1', expires_at: Date.now() - 1000, used_at: null }],
    });

    await expect(AuthService.resetPassword('expired-token', 'newpassword123')).rejects.toThrow(
      'Invalid or expired reset link'
    );
  });

  it('updates the password, marks the token used, and revokes refresh tokens on success', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: 'token-1', user_id: 'user-1', expires_at: Date.now() + 10000, used_at: null }],
      }) // SELECT token
      .mockResolvedValueOnce({ rows: [] }) // UPDATE users password_hash
      .mockResolvedValueOnce({ rows: [] }) // UPDATE password_reset_tokens used_at
      .mockResolvedValueOnce({ rows: [] }); // DELETE refresh_tokens

    await AuthService.resetPassword('good-token', 'newpassword123');

    expect(mockQuery.mock.calls[1][0]).toMatch(/UPDATE users SET password_hash/);
    expect(mockQuery.mock.calls[1][1][1]).toBe('user-1');
    expect(mockQuery.mock.calls[2][0]).toMatch(/UPDATE password_reset_tokens SET used_at/);
    expect(mockQuery.mock.calls[2][1][1]).toBe('token-1');
    expect(mockQuery.mock.calls[3][0]).toMatch(/DELETE FROM refresh_tokens/);
    expect(mockQuery.mock.calls[3][1]).toEqual(['user-1']);
  });
});
