import { resolveEventSharing } from '../syncPrivacy';
import type { Partner } from '@/types/shared';

const partner: Partner = {
  id: 'partner-1',
  alias: 'Partner',
  partnershipId: 'partnership-1',
  status: 'active',
};

describe('resolveEventSharing', () => {
  it('is never shared when there is no partner, regardless of privacy flag', () => {
    expect(resolveEventSharing(undefined, 0)).toEqual({ isShared: false, partnershipId: null });
    expect(resolveEventSharing(undefined, 1)).toEqual({ isShared: false, partnershipId: null });
  });

  it('is not shared when the event is private, even with an active partner', () => {
    expect(resolveEventSharing(partner, 1)).toEqual({ isShared: false, partnershipId: null });
  });

  it('is shared with the partner partnershipId when a partner exists and the event is not private', () => {
    expect(resolveEventSharing(partner, 0)).toEqual({
      isShared: true,
      partnershipId: 'partnership-1',
    });
  });
});
