import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  Animated,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from 'react-i18next';

interface LockScreenProps {
  onUnlockWithBiometric: () => Promise<boolean>;
  onUnlockWithPin: (pin: string) => Promise<boolean>;
  hasBiometric: boolean;
}

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

export function LockScreen({ onUnlockWithBiometric, onUnlockWithPin, hasBiometric }: LockScreenProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const shakeAnim = useState(new Animated.Value(0))[0];

  const c = theme.colors;

  const shake = () => {
    Vibration.vibrate(200);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleKey = async (key: string) => {
    if (key === '⌫') {
      setPin((p) => p.slice(0, -1));
      setError(false);
      return;
    }
    if (key === '') return;
    const next = pin + key;
    setPin(next);
    if (next.length === 4) {
      const ok = await onUnlockWithPin(next);
      if (!ok) {
        setError(true);
        shake();
        setTimeout(() => setPin(''), 600);
      }
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    lockIcon: { fontSize: 56, marginBottom: 16 },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: c.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: c.textMuted,
      marginBottom: 48,
    },
    dotsRow: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 48,
    },
    dot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2,
    },
    errorText: {
      color: c.error,
      fontSize: 13,
      marginTop: -32,
      marginBottom: 32,
    },
    grid: {
      width: 280,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'center',
    },
    key: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    keyText: {
      fontSize: 24,
      fontWeight: '600',
      color: c.text,
    },
    keyEmpty: { backgroundColor: 'transparent' },
    biometricBtn: {
      marginTop: 32,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: c.border,
    },
    biometricText: { color: c.primary, fontSize: 15, fontWeight: '600' },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.lockIcon}>🔒</Text>
      <Text style={styles.title}>{t('privacy.unlock')}</Text>
      <Text style={styles.subtitle}>{t('privacy.enterPin')}</Text>

      <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                borderColor: error ? c.error : c.primary,
                backgroundColor: i < pin.length ? (error ? c.error : c.primary) : 'transparent',
              },
            ]}
          />
        ))}
      </Animated.View>

      {error && <Text style={styles.errorText}>{t('privacy.wrongPin')}</Text>}

      <View style={styles.grid}>
        {KEYS.map((key, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.key, key === '' && styles.keyEmpty]}
            onPress={() => handleKey(key)}
            disabled={key === ''}
            activeOpacity={0.7}
          >
            <Text style={styles.keyText}>{key}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {hasBiometric && (
        <TouchableOpacity style={styles.biometricBtn} onPress={onUnlockWithBiometric}>
          <Text style={styles.biometricText}>👆 {t('privacy.useBiometric')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
