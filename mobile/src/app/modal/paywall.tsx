import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { useTheme } from '@/context/ThemeContext';
import { useEntitlementStore } from '@/store/useEntitlementStore';
import { getCurrentOffering, purchasePackage as purchasePackageRC, restorePurchases as restorePurchasesRC } from '@/services/purchases';

async function waitForEntitlement(maxAttempts = 5, delayMs = 1500): Promise<boolean> {
  const refresh = useEntitlementStore.getState().refresh;
  for (let i = 0; i < maxAttempts; i++) {
    await refresh();
    if (useEntitlementStore.getState().premium) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return useEntitlementStore.getState().premium;
}

export default function PaywallModal() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useTranslation();
  const router = useRouter();

  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loadingOffering, setLoadingOffering] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  useEffect(() => {
    getCurrentOffering()
      .then(setOffering)
      .catch((err) => console.error('[Paywall] Failed to load offering:', err))
      .finally(() => setLoadingOffering(false));
  }, []);

  const handlePurchase = async (pkg: PurchasesPackage) => {
    setPurchasing(pkg.identifier);
    try {
      await purchasePackageRC(pkg);
      const confirmed = await waitForEntitlement();
      if (confirmed) {
        handleBack();
      } else {
        Alert.alert(t('paywall.title'), t('paywall.confirmingDelay'));
        handleBack();
      }
    } catch (err: any) {
      if (!err?.userCancelled) {
        Alert.alert(t('common.error'), err?.message || t('paywall.purchaseFailed'));
      }
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestore = async () => {
    setPurchasing('restore');
    try {
      await restorePurchasesRC();
      const confirmed = await waitForEntitlement(3, 800);
      if (confirmed) {
        Alert.alert(t('paywall.title'), t('paywall.restoreSuccess'));
        handleBack();
      } else {
        Alert.alert(t('paywall.title'), t('paywall.restoreNotFound'));
      }
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message || t('paywall.purchaseFailed'));
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Text style={{ color: c.primary, fontSize: 16 }}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.text }]}>{t('paywall.title')}</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 12 }}>✨</Text>
        <Text style={[styles.heading, { color: c.text }]}>{t('paywall.heading')}</Text>
        <Text style={[styles.body, { color: c.textSecondary }]}>{t('paywall.body')}</Text>

        {loadingOffering ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={c.primary} />
        ) : !offering || offering.availablePackages.length === 0 ? (
          <Text style={[styles.body, { color: c.textMuted, marginTop: 24 }]}>{t('paywall.unavailable')}</Text>
        ) : (
          offering.availablePackages.map((pkg) => (
            <TouchableOpacity
              key={pkg.identifier}
              style={[styles.packageCard, { backgroundColor: c.surface, borderColor: c.primary }]}
              onPress={() => handlePurchase(pkg)}
              disabled={!!purchasing}
            >
              {purchasing === pkg.identifier ? (
                <ActivityIndicator color={c.primary} />
              ) : (
                <>
                  <Text style={[styles.packageTitle, { color: c.text }]}>{pkg.product.title}</Text>
                  <Text style={[styles.packagePrice, { color: c.primary }]}>{pkg.product.priceString}</Text>
                </>
              )}
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity onPress={handleRestore} disabled={!!purchasing} style={styles.restoreBtn}>
          <Text style={{ color: c.textMuted, fontSize: 13 }}>
            {purchasing === 'restore' ? t('paywall.restoring') : t('paywall.restore')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontSize: 18, fontWeight: '700' },
  scroll: { padding: 20, paddingTop: 4 },
  heading: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  packageCard: {
    borderRadius: 16, borderWidth: 1.5, padding: 20, marginTop: 20, alignItems: 'center',
  },
  packageTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  packagePrice: { fontSize: 22, fontWeight: '800' },
  restoreBtn: { alignItems: 'center', marginTop: 24, padding: 8 },
});
