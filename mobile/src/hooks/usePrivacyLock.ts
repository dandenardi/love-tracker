import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { storage } from '@/services/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PIN_KEY = 'appPin';
const BIOMETRIC_KEY = '@love-tracker/biometricEnabled';
const TIMEOUT_KEY = '@love-tracker/lockTimeout';

export function usePrivacyLock() {
  const [isLocked, setIsLocked] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const lastActiveRef = useRef<number>(Date.now());
  const appStateRef = useRef<AppStateStatus>('active');
  // Use refs so AppState callbacks always see the latest values
  const biometricRef = useRef(false);
  const timeoutRef = useRef(0);

  const isBiometricEnabled = () => biometricRef.current;
  const getPin = () => storage.getItem(PIN_KEY);
  const getTimeout = () => timeoutRef.current;

  const isProtected = async () => {
    const pin = await storage.getItem(PIN_KEY);
    return biometricRef.current || !!pin;
  };

  const unlockWithBiometric = useCallback(async (): Promise<boolean> => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Love Tracker',
      fallbackLabel: 'Use PIN',
      disableDeviceFallback: false,
    });
    if (result.success) setIsLocked(false);
    return result.success;
  }, []);

  const unlockWithPin = useCallback(async (pin: string): Promise<boolean> => {
    const stored = await storage.getItem(PIN_KEY);
    if (stored === pin) {
      setIsLocked(false);
      return true;
    }
    return false;
  }, []);

  const setPin = async (pin: string) => {
    await storage.setItem(PIN_KEY, pin);
  };

  const clearPin = async () => {
    await storage.deleteItem(PIN_KEY);
  };

  const setBiometric = async (enabled: boolean) => {
    biometricRef.current = enabled;
    await AsyncStorage.setItem(BIOMETRIC_KEY, String(enabled));
  };

  const setLockTimeout = async (minutes: number) => {
    timeoutRef.current = minutes;
    await AsyncStorage.setItem(TIMEOUT_KEY, String(minutes));
  };

  const shouldLock = () => {
    const elapsed = (Date.now() - lastActiveRef.current) / 60000;
    return elapsed >= timeoutRef.current;
  };

  const tryAutoUnlock = useCallback(async () => {
    if (biometricRef.current) await unlockWithBiometric();
  }, [unlockWithBiometric]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (appStateRef.current === 'active' && nextState.match(/inactive|background/)) {
        lastActiveRef.current = Date.now();
      }
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        const pin = await storage.getItem(PIN_KEY);
        const protected_ = biometricRef.current || !!pin;
        if (protected_ && shouldLock()) {
          setIsLocked(true);
          await tryAutoUnlock();
        }
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, [tryAutoUnlock]);

  useEffect(() => {
    (async () => {
      const [biometricStr, timeoutStr, pin] = await Promise.all([
        AsyncStorage.getItem(BIOMETRIC_KEY),
        AsyncStorage.getItem(TIMEOUT_KEY),
        storage.getItem(PIN_KEY),
      ]);

      biometricRef.current = biometricStr === 'true';
      timeoutRef.current = timeoutStr !== null ? parseInt(timeoutStr, 10) : 0;

      const protected_ = biometricRef.current || !!pin;
      if (protected_) {
        setIsLocked(true);
        if (biometricRef.current) await unlockWithBiometric();
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
