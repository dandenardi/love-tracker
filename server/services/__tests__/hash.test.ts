import { oneWayHash } from '../hash';

describe('oneWayHash', () => {
  it('is deterministic — same input always produces the same output', () => {
    expect(oneWayHash('partnership-abc-123')).toBe(oneWayHash('partnership-abc-123'));
  });

  it('produces different outputs for different inputs', () => {
    expect(oneWayHash('partnership-abc-123')).not.toBe(oneWayHash('partnership-xyz-789'));
  });

  it('returns exactly 16 lowercase hex characters, matching the mobile contactToken scheme', () => {
    const hash = oneWayHash('some-partnership-id');
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('never returns the raw input verbatim', () => {
    const input = 'a-very-obviously-real-partnership-uuid';
    expect(oneWayHash(input)).not.toBe(input);
    expect(oneWayHash(input)).not.toContain(input);
  });
});
