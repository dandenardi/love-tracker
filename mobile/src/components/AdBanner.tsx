import React, { useState } from 'react';
import { View } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import Constants from 'expo-constants';
import { useEntitlementStore } from '@/store/useEntitlementStore';

/**
 * Banner ad shown only on secondary/browsing screens (Stats, Settings) — never on Home,
 * Timeline, or event log/edit flows. Renders nothing for premium users, and nothing if the
 * ad fails to load, rather than leaving a broken-looking gap.
 */
export function AdBanner() {
  const premium = useEntitlementStore((s) => s.premium);
  const [failed, setFailed] = useState(false);

  if (premium || failed) return null;

  const prodUnitId = Constants.expoConfig?.extra?.admobBannerUnitId as string | undefined;
  const unitId = __DEV__ || !prodUnitId ? TestIds.BANNER : prodUnitId;

  return (
    <View style={{ alignItems: 'center' }}>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}
