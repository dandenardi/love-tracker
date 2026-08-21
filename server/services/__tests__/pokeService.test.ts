jest.mock('../../db/pool', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));
jest.mock('../notificationService', () => ({
  sendExpoPushNotification: jest.fn(),
}));
jest.mock('../../socket', () => ({
  socketManager: { emitToUser: jest.fn() },
}));

import pool from '../../db/pool';
import { sendExpoPushNotification } from '../notificationService';
import { PokeService } from '../pokeService';

const mockQuery = pool.query as jest.Mock;
const mockSendPush = sendExpoPushNotification as jest.Mock;

describe('PokeService.getPokes', () => {
  it('joins partnerships and only returns pokes from an active partnership', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await PokeService.getPokes('user-1', 0);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('JOIN partnerships p ON p.id = pk.partnership_id');
    expect(sql).toContain("p.status = 'active'");
    expect(params).toEqual(['user-1', 0]);
  });

  it('maps a row into the Poke response shape, coercing timestamps to numbers', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'poke-1',
          sender_id: 'user-2',
          sender_alias: 'Partner',
          message: 'MISS_YOU',
          emoji: '💌',
          sent_at: '1700000000000',
          delivered_at: '1700000001000',
          read_at: null,
        },
      ],
    });

    const result = await PokeService.getPokes('user-1', 0);

    expect(result).toEqual([
      {
        id: 'poke-1',
        senderId: 'user-2',
        senderAlias: 'Partner',
        message: 'MISS_YOU',
        emoji: '💌',
        sentAt: 1700000000000,
        deliveredAt: 1700000001000,
        readAt: undefined,
      },
    ]);
  });
});

describe('PokeService.sendPoke', () => {
  it('composes the push notification body in the recipient locale, not the sender locale', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ partnership_id: 'partnership-1' }] }) // active partnership check
      .mockResolvedValueOnce({ rows: [{ id: 'poke-1' }] }) // INSERT INTO pokes
      .mockResolvedValueOnce({ rows: [{ alias: 'Ana' }] }) // sender alias
      .mockResolvedValueOnce({ rows: [{ push_token: 'ExponentPushToken[xxx]', locale: 'pt' }] }); // recipient

    await PokeService.sendPoke('user-1', { partnerId: 'user-2', message: 'MISS_YOU', emoji: '💌' });

    expect(mockSendPush).toHaveBeenCalledWith(
      'ExponentPushToken[xxx]',
      'Ana',
      '💌 Ana te enviou um toque!',
      expect.anything(),
      'POKE_CATEGORY'
    );
  });
});
