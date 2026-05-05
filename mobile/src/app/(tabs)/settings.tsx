import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, TextInput, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { THEMES, type ThemeKey } from '@/constants/themes';
import { usePrivacyLock } from '@/hooks/usePrivacyLock';
import { useSyncStore } from '@/store/useSyncStore';
import { useContactsStore } from '@/store/useContactsStore';
import { usePokeStore } from '@/store/usePokeStore';
import { PokeMessage, schedulePokeNotification, registerPokeCategory } from '@/services/notificationService';
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
  const [targetContactId, setTargetContactId] = useState<string | null>(null);
  const [shareHistory, setShareHistory] = useState(true);
  
  const localContacts = useContactsStore(s => s.contacts).filter(c => !c.partner_user_id);

  React.useEffect(() => {
    let interval: any;
    if (inviteCode) {
      interval = setInterval(() => {
        sync.sync();
      }, 10000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [inviteCode]);

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
      await sync.pairWithCode(pairCode, targetContactId || undefined, shareHistory);
      setPairCode('');
      setTargetContactId(null);
      setShareHistory(true);
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

  const handleUnpair = (partnerId: string, partnerAlias: string) => {
    Alert.alert(
      t('settings.unpairConfirmTitle'),
      t('settings.unpairConfirmDesc', { name: partnerAlias }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('settings.unpair'), style: 'destructive', onPress: () => sync.unpair(partnerId) }
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('settings.deleteAccountConfirmTitle'),
      t('settings.deleteAccountConfirmDesc'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: async () => {
          try {
            await sync.deleteAccount();
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        }}
      ]
    );
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
        <SettingRow label={`Hi, ${sync.alias}`} desc={t('settings.partnershipsActive', { count: sync.partners.filter(p => p.status === 'active').length })}>
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
            <TouchableOpacity onPress={sync.logout}>
              <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '600' }}>Logout</Text>
            </TouchableOpacity>
            <View style={{ width: 1, height: 12, backgroundColor: c.border }} />
            <TouchableOpacity onPress={handleDeleteAccount}>
              <Text style={{ color: c.error, fontSize: 13, fontWeight: '600' }}>{t('settings.deleteAccount')}</Text>
            </TouchableOpacity>
          </View>
        </SettingRow>

        {sync.partners.length > 0 && (
          <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }}>
            {sync.partners.map((p, idx) => (
              <SettingRow 
                key={p.id} 
                label={p.alias} 
                desc={p.status === 'active' ? t('settings.activeSync') : t('settings.unpaired')}
                last={idx === sync.partners.length - 1 && !inviteCode}
              >
                {p.status === 'active' && (
                  <TouchableOpacity onPress={() => handleUnpair(p.id, p.alias)}>
                    <Text style={{ color: c.error, fontSize: 12, fontWeight: '600' }}>{t('settings.unpair')}</Text>
                  </TouchableOpacity>
                )}
              </SettingRow>
            ))}
          </View>
        )}

        <View style={{ padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }}>
          <Text style={[styles.rowLabel, { color: c.text, fontSize: 12, marginBottom: 12 }]}>{t('settings.addNewPartner')}</Text>
          
          {inviteCode ? (
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: c.textSecondary, fontSize: 12, marginBottom: 4 }}>Your Pair Code:</Text>
              <Text style={{ color: c.primary, fontSize: 24, fontWeight: '800', letterSpacing: 2 }}>{inviteCode}</Text>
              <Text style={{ color: c.textMuted, fontSize: 10, marginTop: 4 }}>Expires in 30 minutes</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 }}>
                <ActivityIndicator size="small" color={c.primary} />
                <Text style={{ color: c.textSecondary, fontSize: 13 }}>Waiting for partner...</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={handleGenerateInvite} style={[styles.secondaryBtn, { borderColor: c.primary, paddingVertical: 10 }]}>
              <Text style={{ color: c.primary, fontWeight: '700', fontSize: 14 }}>{t('settings.generateInvite')}</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 1, backgroundColor: c.border, marginVertical: 16 }} />

          <Text style={{ color: c.textSecondary, fontSize: 12, marginBottom: 8 }}>{t('settings.enterPartnerCode')}</Text>
          
          {localContacts.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: c.textMuted, fontSize: 10, marginBottom: 6 }}>{t('settings.linkExisting').toUpperCase()}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <TouchableOpacity 
                  onPress={() => setTargetContactId(null)}
                  style={[styles.chip, { borderColor: !targetContactId ? c.primary : c.border, backgroundColor: !targetContactId ? c.primary + '25' : 'transparent' }]}
                >
                  <Text style={{ color: !targetContactId ? c.primary : c.textMuted, fontSize: 11 }}>{t('settings.none')}</Text>
                </TouchableOpacity>
                {localContacts.map(lc => (
                  <TouchableOpacity 
                    key={lc.id}
                    onPress={() => setTargetContactId(lc.id)}
                    style={[styles.chip, { borderColor: targetContactId === lc.id ? c.primary : c.border, backgroundColor: targetContactId === lc.id ? c.primary + '25' : 'transparent' }]}
                  >
                    <Text style={{ color: targetContactId === lc.id ? c.primary : c.textMuted, fontSize: 11 }}>{lc.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {targetContactId && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, padding: 8, backgroundColor: c.surfaceAlt, borderRadius: 8 }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ color: c.text, fontSize: 12, fontWeight: '600' }}>{t('settings.shareHistory')}</Text>
                    <Text style={{ color: c.textMuted, fontSize: 10 }}>{t('settings.shareHistoryDesc')}</Text>
                  </View>
                  <Switch 
                    value={shareHistory} 
                    onValueChange={setShareHistory} 
                    trackColor={{ true: c.primary }}
                    thumbColor="#FFF"
                  />
                </View>
              )}
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              placeholder="ABC-123"
              placeholderTextColor={c.textMuted}
              style={[styles.input, { flex: 1, marginBottom: 0, borderColor: c.border, color: c.text, paddingVertical: 8 }]}
              value={pairCode}
              onChangeText={setPairCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity onPress={handlePair} style={[styles.primaryBtn, { backgroundColor: c.primary, paddingHorizontal: 20, paddingVertical: 8 }]}>
              <Text style={styles.btnText}>{t('settings.pair')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }}>
          <TouchableOpacity
            onPress={() => sync.sync()}
            disabled={sync.isSyncing}
            style={[styles.primaryBtn, { backgroundColor: c.primary, flexDirection: 'row', gap: 8 }]}
          >
            {sync.isSyncing ? <ActivityIndicator color="#FFF" /> : (
              <>
                <Text style={{ fontSize: 16 }}>🔄</Text>
                <Text style={styles.btnText}>{t('settings.syncAll')}</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={{ color: c.textMuted, fontSize: 10, textAlign: 'center', marginTop: 8 }}>
            Last synced: {sync.lastSyncedAt > 0 ? new Date(sync.lastSyncedAt).toLocaleString() : 'Never'}
          </Text>
        </View>
      </View>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Poke Slots Section
// ─────────────────────────────────────────────────────────────────────────────

function PokeSection() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useTranslation();
  const sync = useSyncStore();
  const { slots, allMessages, setSlots, isSending } = usePokeStore();

  const [pickerSlot, setPickerSlot] = useState<0 | 1 | 2 | null>(null);
  const [localSlots, setLocalSlots] = useState<[PokeMessage, PokeMessage, PokeMessage]>(slots);

  const activePartner = sync.partners.find(p => p.status === 'active');
  if (!sync.userId || !activePartner) return null;

  const getLabel = (key: string) => t(`poke.messages.${key}`, { defaultValue: key });

  const handleSlotChange = async (slotIdx: 0 | 1 | 2, msg: PokeMessage) => {
    const updated: [PokeMessage, PokeMessage, PokeMessage] = [...localSlots] as any;
    updated[slotIdx] = msg;
    setLocalSlots(updated);
    setPickerSlot(null);
    await setSlots(
      updated,
      { partnerId: activePartner.id, partnerName: activePartner.alias, slots: updated },
      t('poke.notifTitle'),
      t('poke.notifBody', { name: activePartner.alias }),
      getLabel
    );
  };

  const handleTestPoke = async () => {
    const slot = localSlots[0];
    try {
      await usePokeStore.getState().sendPoke(activePartner.id, slot.key, slot.emoji);
      Alert.alert('✅', t('poke.testSent'));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <>
      <SectionHeader label={t('poke.sectionTitle')} />
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={{ padding: 16 }}>
          <Text style={{ color: c.textMuted, fontSize: 12, marginBottom: 14 }}>
            {t('poke.sectionDesc')}
          </Text>

          {([0, 1, 2] as const).map(idx => (
            <View key={idx} style={{ marginBottom: 10 }}>
              <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 6 }}>
                {t('poke.slotLabel', { n: idx + 1 })}
              </Text>
              <TouchableOpacity
                id={`poke-slot-${idx}`}
                onPress={() => setPickerSlot(idx)}
                style={[
                  styles.slotBtn,
                  { backgroundColor: c.surfaceAlt, borderColor: c.border }
                ]}
              >
                <Text style={{ fontSize: 20 }}>{localSlots[idx].emoji}</Text>
                <Text style={{ color: c.text, fontSize: 13, fontWeight: '600', flex: 1, marginLeft: 10 }}>
                  {getLabel(localSlots[idx].key)}
                </Text>
                <Text style={{ color: c.textMuted, fontSize: 12 }}>▾</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity
            id="poke-test-btn"
            onPress={handleTestPoke}
            disabled={isSending}
            style={[styles.secondaryBtn, { borderColor: c.primary, marginTop: 4 }]}
          >
            {isSending
              ? <ActivityIndicator color={c.primary} />
              : <Text style={{ color: c.primary, fontWeight: '700', fontSize: 14 }}>👈 {t('poke.testButton')}</Text>
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* Slot Picker Modal */}
      <Modal
        visible={pickerSlot !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerSlot(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: c.surface }]}>
            <Text style={[styles.rowLabel, { color: c.text, marginBottom: 16 }]}>
              {t('poke.slotLabel', { n: (pickerSlot ?? 0) + 1 })}
            </Text>
            <FlatList
              data={allMessages}
              keyExtractor={item => item.key}
              renderItem={({ item }) => {
                const isSelected = localSlots[pickerSlot ?? 0]?.key === item.key;
                return (
                  <TouchableOpacity
                    id={`poke-msg-${item.key}`}
                    onPress={() => pickerSlot !== null && handleSlotChange(pickerSlot, item)}
                    style={[
                      styles.messageRow,
                      { borderBottomColor: c.border, backgroundColor: isSelected ? c.primary + '15' : 'transparent' }
                    ]}
                  >
                    <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
                    <Text style={[
                      styles.rowLabel,
                      { flex: 1, marginLeft: 12, color: isSelected ? c.primary : c.text }
                    ]}>
                      {getLabel(item.key)}
                    </Text>
                    {isSelected && <Text style={{ color: c.primary }}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity
              onPress={() => setPickerSlot(null)}
              style={[styles.primaryBtn, { backgroundColor: c.surfaceAlt, marginTop: 16 }]}
            >
              <Text style={{ color: c.textMuted, fontWeight: '600' }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

        {/* ── Cutucar / Poke ── */}
        <PokeSection />

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
  slotBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 12, padding: 12,
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '80%',
  },
  messageRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
});

export default SettingsScreen;
