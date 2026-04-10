import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { THEMES, type ThemeKey } from '@/constants/themes';
import { usePrivacyLock } from '@/hooks/usePrivacyLock';
import { setLanguage } from '@/i18n';

function SectionHeader({ label }: { label: string }) {
  const { theme } = useTheme();
  return <Text style={[styles.sectionHeader, { color: theme.colors.textMuted }]}>{label.toUpperCase()}</Text>;
}

function SettingRow({ label, desc, children, last }: { label: string; desc?: string; children?: React.ReactNode; last?: boolean }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={[styles.row, { borderBottomColor: last ? 'transparent' : c.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: c.text }]}>{label}</Text>
        {desc && <Text style={[styles.rowDesc, { color: c.textMuted }]}>{desc}</Text>}
      </View>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const { theme, themeKey, setTheme } = useTheme();
  const c = theme.colors;
  const { t, i18n } = useTranslation();
  const { isBiometricEnabled, setBiometric, setLockTimeout, getTimeout } = usePrivacyLock();
  const [biometric, setBiometricState] = useState(isBiometricEnabled());
  const [timeout, setTimeoutState] = useState(getTimeout());

  const handleBiometric = (val: boolean) => {
    setBiometricState(val);
    setBiometric(val);
  };

  const handleTimeout = (minutes: number) => {
    setTimeoutState(minutes);
    setLockTimeout(minutes);
  };

  const TIMEOUT_OPTIONS = [
    { label: t('settings.timeoutOptions.immediately'), value: 0 },
    { label: t('settings.timeoutOptions.1min'), value: 1 },
    { label: t('settings.timeoutOptions.5min'), value: 5 },
    { label: t('settings.timeoutOptions.15min'), value: 15 },
  ];

  const LANGUAGES = [
    { code: 'en', label: '🇺🇸 English' },
    { code: 'pt', label: '🇧🇷 Português' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text }]}>⚙️ {t('settings.title')}</Text>
        </View>

        {/* ── Privacy ── */}
        <SectionHeader label={t('settings.privacy')} />
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <SettingRow label={t('settings.biometric')} desc={t('settings.biometricDesc')}>
            <Switch value={biometric} onValueChange={handleBiometric} trackColor={{ true: c.primary }} thumbColor="#FFF" />
          </SettingRow>
          <SettingRow label={t('settings.lockTimeout')} last>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {TIMEOUT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => handleTimeout(opt.value)}
                  style={[styles.chip, { borderColor: timeout === opt.value ? c.primary : c.border, backgroundColor: timeout === opt.value ? c.primary + '25' : 'transparent' }]}
                >
                  <Text style={{ color: timeout === opt.value ? c.primary : c.textMuted, fontSize: 11, fontWeight: '600' }}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </SettingRow>
        </View>

        {/* ── Theme ── */}
        <SectionHeader label={t('settings.theme')} />
        <View style={styles.themeGrid}>
          {(Object.values(THEMES)).map((t_) => (
            <TouchableOpacity
              key={t_.key}
              onPress={() => setTheme(t_.key as ThemeKey)}
              style={[
                styles.themeCard,
                { backgroundColor: t_.colors.surface, borderColor: themeKey === t_.key ? t_.colors.primary : t_.colors.border },
              ]}
            >
              <Text style={{ fontSize: 28 }}>{t_.emoji}</Text>
              <Text style={{ color: t_.colors.text, fontSize: 11, fontWeight: '700', marginTop: 6 }}>{t_.name}</Text>
              <View style={[styles.themeAccentDot, { backgroundColor: t_.colors.primary }]} />
              {themeKey === t_.key && (
                <View style={[styles.themeCheck, { backgroundColor: t_.colors.primary }]}>
                  <Text style={{ color: '#FFF', fontSize: 10 }}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Language ── */}
        <SectionHeader label={t('settings.language')} />
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          {LANGUAGES.map((lang, idx) => (
            <SettingRow key={lang.code} label={lang.label} last={idx === LANGUAGES.length - 1}>
              <TouchableOpacity
                onPress={() => setLanguage(lang.code)}
                style={[styles.chip, { borderColor: i18n.language === lang.code ? c.primary : c.border, backgroundColor: i18n.language === lang.code ? c.primary + '25' : 'transparent' }]}
              >
                <Text style={{ color: i18n.language === lang.code ? c.primary : c.textMuted, fontSize: 12, fontWeight: '600' }}>
                  {i18n.language === lang.code ? '✓ Active' : 'Select'}
                </Text>
              </TouchableOpacity>
            </SettingRow>
          ))}
        </View>

        {/* ── Partner Sync (Coming Soon) ── */}
        <SectionHeader label={t('settings.partner')} />
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <SettingRow label={t('settings.partner')} desc={t('settings.partnerDesc')} last>
            <Text style={{ fontSize: 20 }}>🔒</Text>
          </SettingRow>
        </View>

        <Text style={[styles.version, { color: c.textMuted }]}>Love Tracker v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 48 },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '800' },
  sectionHeader: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 20, marginBottom: 8 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 14, fontWeight: '600' },
  rowDesc: { fontSize: 12, marginTop: 2 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 12, borderWidth: 1.5,
  },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  themeCard: {
    width: '30%', padding: 14, borderRadius: 16, borderWidth: 2,
    alignItems: 'center', position: 'relative',
  },
  themeAccentDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  themeCheck: {
    position: 'absolute', top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  version: { textAlign: 'center', fontSize: 12, marginTop: 32 },
});
