import Purchases, { LOG_LEVEL, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import Constants from 'expo-constants';

let configured = false;

/**
 * Configures the RevenueCat SDK with our own JWT user id as `appUserID` — this is RevenueCat's
 * recommended integration pattern, and it's what lets webhook payloads carry our own user id
 * directly (no separate id-mapping table needed server-side). See specs/003-premium-entitlements.
 */
export function initPurchases(userId: string): void {
  const apiKey = Constants.expoConfig?.extra?.revenueCatAndroidKey;
  if (!apiKey) {
    console.warn('[Purchases] No RevenueCat API key configured — premium purchases unavailable.');
    return;
  }
  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }
  Purchases.configure({ apiKey, appUserID: userId });
  configured = true;
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<void> {
  await Purchases.purchasePackage(pkg);
}

export async function restorePurchases(): Promise<void> {
  await Purchases.restorePurchases();
}
