import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'love-tracker-prefs' });
const PIN_KEY = 'appPin';
const BIOMETRIC_KEY = 'biometricEnabled';
const TIMEOUT_KEY = 'lockTimeout'; // in minutes; 0 = immediate

export function usePrivacyLock() {
  const [isLocked, setIsLocked] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const lastActiveRef = useRef<number>(Date.now());
  const appStateRef = useRef<AppStateStatus>('active');

  const isBiometricEnabled = () => storage.getBoolean(BIOMETRIC_KEY) ?? false;
  const getPin = () => SecureStore.getItemAsync(PIN_KEY);
  const getTimeout = () => storage.getNumber(TIMEOUT_KEY) ?? 0; // minutes

  const isProtected = () => {
    return isBiometricEnabled() || !!SecureStore.getItemAsync(PIN_KEY);
  };

  /**
   * Attempt biometric unlock. Returns true on success.
   */
  const unlockWithBiometric = useCallback(async (): Promise<boolean> => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Love Tracker',
      fallbackLabel: 'Use PIN',
      disableDeviceFallback: false,
    });
    if (result.success) {
      setIsLocked(false);
    }
    return result.success;
  }, []);

  /**
   * Attempt PIN unlock. Returns true if PIN matches.
   */
  const unlockWithPin = useCallback(async (pin: string): Promise<boolean> => {
    const stored = await SecureStore.getItemAsync(PIN_KEY);
    if (stored === pin) {
      setIsLocked(false);
      return true;
    }
    return false;
  }, []);

  /**
   * Save PIN to SecureStore.
   */
  const setPin = async (pin: string) => {
    await SecureStore.setItemAsync(PIN_KEY, pin);
  };

  /**
   * Remove saved PIN.
   */
  const clearPin = async () => {
    await SecureStore.deleteItemAsync(PIN_KEY);
  };

  /**
   * Toggle biometric lock.
   */
  const setBiometric = (enabled: boolean) => {
    storage.set(BIOMETRIC_KEY, enabled);
  };

  /**
   * Set lock timeout in minutes (0 = immediate).
   */
  const setLockTimeout = (minutes: number) => {
    storage.set(TIMEOUT_KEY, minutes);
  };

  /**
   * Check if lock should engage based on elapsed time.
   */
  const shouldLock = () => {
    const timeout = getTimeout();
    const elapsed = (Date.now() - lastActiveRef.current) / 60000;
    return elapsed >= timeout;
  };

  /**
   * Attempt auto-unlock (called when app returns to foreground).
   */
  const tryAutoUnlock = useCallback(async () => {
    if (isBiometricEnabled()) {
      await unlockWithBiometric();
    }
  }, [unlockWithBiometric]);

  // Watch AppState to lock on background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (appStateRef.current === 'active' && nextState.match(/inactive|background/)) {
        lastActiveRef.current = Date.now();
      }

      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        const hasBiometric = isBiometricEnabled();
        const pin = await SecureStore.getItemAsync(PIN_KEY);
        const protected_ = hasBiometric || !!pin;

        if (protected_ && shouldLock()) {
          setIsLocked(true);
          await tryAutoUnlock();
        }
      }
      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, [tryAutoUnlock]);

  // Initialize on mount
  useEffect(() => {
    (async () => {
      const hasBiometric = isBiometricEnabled();
      const pin = await SecureStore.getItemAsync(PIN_KEY);
      const protected_ = hasBiometric || !!pin;

      if (protected_) {
        setIsLocked(true);
        if (hasBiometric) await unlockWithBiometric();
      }
      setIsReady(true);
    })();
  }, []);

  return {
    isLocked,
    isReady,
    isBiometricEnabled,
    unlockWithBiometric,
    unlockWithPin,
    setPin,
    clearPin,
    setBiometric,
    setLockTimeout,
    getTimeout,
  };
}
