import type { Partner } from '@/types/shared';

export interface EventSharingDecision {
  isShared: boolean;
  partnershipId: string | null;
}

/**
 * Determines whether a locally-logged event should be pushed to the server as shared with
 * a partner or kept as an own-only backup. Purely a pure function over already-resolved
 * partner/privacy state so it can be unit tested without mocking SQLite/network.
 */
export function resolveEventSharing(partner: Partner | undefined, isPrivate: number): EventSharingDecision {
  const isShared = !!partner && isPrivate === 0;
  return { isShared, partnershipId: isShared ? partner!.partnershipId : null };
}
