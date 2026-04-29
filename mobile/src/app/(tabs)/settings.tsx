import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { THEMES, type ThemeKey } from '@/constants/themes';
import { usePrivacyLock } from '@/hooks/usePrivacyLock';
import { useSyncStore } from '@/store/useSyncStore';
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

function PartnerSyncSection() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useTranslation();
  const sync = useSyncStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [alias, setAlias] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [pairCode, setPairCode] = useState('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  const handleAuth = async () => {
    try {
      if (isRegistering) {
        await sync.register(email, password, alias);
      } else {
        await sync.login(email, password);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handlePair = async () => {
    try {
      await sync.pairWithCode(pairCode);
      setPairCode('');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleGenerateInvite = async () => {
    try {
      const code = await sync.generateInvite();
      setInviteCode(code);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  if (!sync.userId) {
    return (
      <>
        <SectionHeader label={t('settings.partner')} />
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, padding: 16 }]}>
          <Text style={[styles.rowLabel, { color: c.text, marginBottom: 12 }]}>
            {isRegistering ? t('auth.createAccount') : t('auth.login')}
          </Text>
          <TextInput
            placeholder="Email"
            placeholderTextColor={c.textMuted}
            style={[styles.input, { borderColor: c.border, color: c.text }]}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />
          {isRegistering && (
            <TextInput
              placeholder="Alias (Display Name)"
              placeholderTextColor={c.textMuted}
              style={[styles.input, { borderColor: c.border, color: c.text }]}
              value={alias}
              onChangeText={setAlias}
            />
          )}
          <TextInput
            placeholder="Password"
            placeholderTextColor={c.textMuted}
            style={[styles.input, { borderColor: c.border, color: c.text }]}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity
            onPress={handleAuth}
            disabled={sync.isSyncing}
            style={[styles.primaryBtn, { backgroundColor: c.primary }]}
          >
            {sync.isSyncing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>{isRegistering ? 'Register' : 'Login'}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)} style={{ marginTop: 12, alignItems: 'center' }}>
            <Text style={{ color: c.primary, fontSize: 13 }}>
              {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
            </Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <SectionHeader label={t('settings.partner')} />
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <SettingRow label={`Hi, ${sync.alias}`} desc={sync.partnerId ? `Paired with ${sync.partnerAlias}` : 'Not paired yet'}>
          <TouchableOpacity onPress={sync.logout}>
            <Text style={{ color: c.error, fontSize: 13, fontWeight: '600' }}>Logout</Text>
          </TouchableOpacity>
        </SettingRow>

        {!sync.partnerId && (
          <View style={{ padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }}>
            {inviteCode ? (
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ color: c.textSecondary, fontSize: 12, marginBottom: 4 }}>Your Pair Code:</Text>
                <Text style={{ color: c.primary, fontSize: 24, fontWeight: '800', letterSpacing: 2 }}>{inviteCode}</Text>
                <Text style={{ color: c.textMuted, fontSize: 10, marginTop: 4 }}>Expires in 30 minutes</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={handleGenerateInvite} style={[styles.secondaryBtn, { borderColor: c.primary }]}>
                <Text style={{ color: c.primary, fontWeight: '700' }}>Generate Invite Code</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 1, backgroundColor: c.border, marginVertical: 16 }} />

            <Text style={{ color: c.textSecondary, fontSize: 12, marginBottom: 8 }}>Or enter partner's code:</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                placeholder="ABC-123"
                placeholderTextColor={c.textMuted}
                style={[styles.input, { flex: 1, marginBottom: 0, borderColor: c.border, color: c.text }]}
                value={pairCode}
                onChangeText={setPairCode}
                autoCapitalize="characters"
              />
              <TouchableOpacity onPress={handlePair} style={[styles.primaryBtn, { backgroundColor: c.primary, paddingHorizontal: 20 }]}>
                <Text style={styles.btnText}>Pair</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {sync.partnerId && (
          <View style={{ padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }}>
            <TouchableOpacity
              onPress={() => sync.sync()}
              disabled={sync.isSyncing}
              style={[styles.primaryBtn, { backgroundColor: c.primary, flexDirection: 'row', gap: 8 }]}
            >
              {sync.isSyncing ? <ActivityIndicator color="#FFF" /> : (
                <>
                  <Text style={{ fontSize: 16 }}>🔄</Text>
                  <Text style={styles.btnText}>Sync Now</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={{ color: c.textMuted, fontSize: 10, textAlign: 'center', marginTop: 8 }}>
              Last synced: {sync.lastSyncedAt > 0 ? new Date(sync.lastSyncedAt).toLocaleString() : 'Never'}
            </Text>
          </View>
        )}
      </View>
    </>
  );
}

function SettingsScreen() {
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

        {/* ── Partner Sync ── */}
        <PartnerSyncSection />

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
  input: {
    borderWidth: 1, borderRadius: 12, padding: 12,
    fontSize: 14, marginBottom: 12,
  },
  primaryBtn: {
    padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtn: {
    padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  btnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});

export default SettingsScreen;
