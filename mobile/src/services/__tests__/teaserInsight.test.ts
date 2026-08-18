import type { TFunction } from 'i18next';
import { getMonthlyTeaser } from '../teaserInsight';
import type { LoveEvent } from '@/types/shared';

const tMock = jest.fn((key: string, opts?: any) => (opts ? `${key}:${JSON.stringify(opts)}` : key));
const t = tMock as unknown as TFunction;

function makeEvent(overrides: Partial<LoveEvent>): LoveEvent {
  return {
    id: 'evt-1',
    type: 'DATE',
    intensity: 3,
    occurred_at: Date.now(),
    logged_at: Date.now(),
    synced: 0,
    is_private: 0,
    ...overrides,
  };
}

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-08-15T12:00:00Z'));
  tMock.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('getMonthlyTeaser', () => {
  it('returns null for an empty events array', () => {
    expect(getMonthlyTeaser([], t)).toBeNull();
  });

  it('excludes events outside the current month/year', () => {
    const events = [makeEvent({ type: 'DATE', occurred_at: new Date('2026-07-15T12:00:00Z').getTime() })];
    expect(getMonthlyTeaser(events, t)).toBeNull();
  });

  it('excludes POKE events from the count', () => {
    const events = [makeEvent({ type: 'POKE', occurred_at: new Date('2026-08-10T12:00:00Z').getTime() })];
    expect(getMonthlyTeaser(events, t)).toBeNull();
  });

  it('picks the type with the highest count in-month and returns icon/text', () => {
    const events = [
      makeEvent({ type: 'AFFECTION', occurred_at: new Date('2026-08-01T12:00:00Z').getTime() }),
      makeEvent({ type: 'AFFECTION', occurred_at: new Date('2026-08-02T12:00:00Z').getTime() }),
      makeEvent({ type: 'DATE', occurred_at: new Date('2026-08-03T12:00:00Z').getTime() }),
    ];

    const result = getMonthlyTeaser(events, t);

    expect(result).not.toBeNull();
    expect(result!.icon).toBe('❤️');
    expect(tMock).toHaveBeenCalledWith('events.affection');
    expect(result!.text).toContain('"count":2');
  });
});
