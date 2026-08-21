import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Animated,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { useContactsStore } from '@/store/useContactsStore';
import { useEventsStore } from '@/store/useEventsStore';
import { useSyncStore } from '@/store/useSyncStore';
import { usePokeStore } from '@/store/usePokeStore';
import { useActivityStore } from '@/store/useActivityStore';
import { EVENT_TYPES, EVENT_TYPE_MAP } from '@/constants/eventTypes';
import { format } from 'date-fns';

// ── Quick‑Log Button ────────────────────────────────────────────────────────
function EventButton({
  icon, label, color, bgColor, onPress, onLongPress,
}: {
  icon: string; label: string; color: string; bgColor: string;
  onPress: () => void; onLongPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animatePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Pressable
      onPress={() => { animatePress(); onPress(); }}
      onLongPress={() => { animatePress(); onLongPress(); }}
      style={{ width: '30%', margin: '1.5%' }}
    >
      <Animated.View style={[styles.eventBtn, { backgroundColor: bgColor, transform: [{ scale }] }]}>
        <View style={[styles.eventBtnRing, { borderColor: color + '55' }]}>
          <Text style={styles.eventBtnIcon}>{icon}</Text>
        </View>
        <Text style={[styles.eventBtnLabel, { color }]} numberOfLines={1}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ── Contact Pill ────────────────────────────────────────────────────────────
function ContactPill({
  name, emoji, color, active, unpaired, unpairedLabel, onPress,
}: {
  name: string; emoji: string; color: string; active: boolean; unpaired?: boolean; unpairedLabel?: string; onPress: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <TouchableOpacity
      style={[
        styles.pill,
        unpaired
          ? { backgroundColor: c.surface, borderColor: c.border, opacity: 0.55 }
          : {
              backgroundColor: active ? color + '30' : c.surface,
              borderColor: active ? color : c.border,
            },
      ]}
      onPress={onPress}
    >
      <Text style={{ fontSize: 16 }}>{emoji}</Text>
      <Text style={[styles.pillText, { color: unpaired ? c.textMuted : active ? color : c.textSecondary }]}>
        {name}{unpaired ? ` · ${unpairedLabel}` : ''}
      </Text>
    </TouchableOpacity>
  );
}

// ── Recent Event Row ────────────────────────────────────────────────────────
function RecentEventRow({ event }: { event: any }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const cfg = EVENT_TYPE_MAP[event.type as keyof typeof EVENT_TYPE_MAP];
  const { t } = useTranslation();
  const isPoke = event.type === 'POKE';

  return (
    <View style={[
      styles.recentRow, 
      { backgroundColor: c.surface, borderColor: c.border },
      isPoke && { borderStyle: 'dashed', borderColor: (cfg?.color ?? c.border) + '66' }
    ]}>
      <View style={[styles.recentIconWrap, { backgroundColor: (cfg?.color ?? c.primary) + '22' }]}>
        <Text style={{ fontSize: 18 }}>
          {isPoke ? (event.note?.split(' ')[0] || '👉') : (cfg?.icon ?? '📝')}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.recentType, { color: cfg?.color ?? c.text }]}>
          {isPoke ? event.title : t(cfg?.labelKey ?? 'events.custom')}
        </Text>
        {event.note ? (
          <Text style={[styles.recentNote, { color: c.textSecondary, fontWeight: isPoke ? '600' : '400' }]} numberOfLines={1}>
            {isPoke ? event.note.substring(event.note.indexOf(' ') + 1) : event.note}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text style={[styles.recentTime, { color: c.textMuted }]}>
          {format(new Date(event.occurred_at), 'HH:mm')}
        </Text>
        {isPoke && (
          <Text style={{ fontSize: 8, color: cfg?.color, fontWeight: '800', textTransform: 'uppercase' }}>
            {t('common.poke')}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Home Screen ─────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useTranslation();
  const router = useRouter();

  const contacts = useContactsStore((s) => s.contacts);
  const activeContactId = useContactsStore((s) => s.activeContactId);
  const soloModeActive = useContactsStore((s) => s.soloModeActive);
  const setActiveContact = useContactsStore((s) => s.setActiveContact);
  const setSoloMode = useContactsStore((s) => s.setSoloMode);
  const effectiveContactId = useContactsStore((s) => s.getEffectiveContactId());
  const activeContact = useContactsStore((s) => s.activeContact());

  const events = useEventsStore((s) => s.events);
  const loadEvents = useEventsStore((s) => s.loadEvents);
  const logEvent = useEventsStore((s) => s.logEvent);

  const partners = useSyncStore((s) => s.partners);
  const activePartner = partners.find(p => p.status === 'active');
  const pokeSlots = usePokeStore((s) => s.slots);
  const sendPoke = usePokeStore((s) => s.sendPoke);
  const isSendingPoke = usePokeStore((s) => s.isSending);
  const activities = useActivityStore((s) => s.activities);
  const unreadCount = activities.filter(a => !a.readAt).length;

  useEffect(() => {
    useActivityStore.getState().loadActivities();
  }, []);

  useEffect(() => {
    if (soloModeActive || activeContactId) loadEvents(effectiveContactId);
  }, [soloModeActive, activeContactId]);

  const handleQuickLog = useCallback(
    async (typeKey: string) => {
      if (!soloModeActive && !activeContactId) {
        Alert.alert(t('contacts.noContacts'), t('contacts.addContact'));
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      logEvent({
        contact_id: effectiveContactId,
        type: typeKey as any,
        intensity: 0,
        occurred_at: Date.now(),
        is_private: 0,
      });
    },
    [soloModeActive, activeContactId, effectiveContactId, logEvent, t]
  );

  const handleSendPoke = useCallback(async (slot: any) => {
    if (!activePartner) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await sendPoke(activePartner.id, slot);
      if (Platform.OS === 'web') {
        alert(t('poke.sentSuccess', { name: activePartner.alias, emoji: slot.emoji }));
      }
    } catch (err: any) {
      if (Platform.OS !== 'web') {
        Alert.alert('Error', err.message);
      }
    }
  }, [activePartner, sendPoke, t]);

  const handleLongPress = useCallback(
    (typeKey: string) => {
      router.push({ pathname: '/modal/log-event', params: { type: typeKey, contactId: effectiveContactId ?? '' } });
    },
    [effectiveContactId, router]
  );

  const recentEvents = events.slice(0, 5);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={[styles.appTitle, { color: c.text }]}>💞 Love Tracker</Text>
            <TouchableOpacity onPress={() => router.push('/modal/notifications')} style={styles.notifBtn}>
              <Text style={{ fontSize: 22 }}>🔔</Text>
              {unreadCount > 0 && (
                <View style={[styles.badge, { backgroundColor: c.error }]}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => router.push('/modal/add-contact')}>
            <View style={[styles.addBtn, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={{ fontSize: 20, color: c.primary }}>＋</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Contact Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsRow} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
          <ContactPill
            name={t('contacts.solo')}
            emoji="📔"
            color={c.primary}
            active={soloModeActive}
            onPress={() => setSoloMode(true)}
          />
          {contacts.map((contact) => {
            // A partner-linked contact whose partnership is no longer active (unpaired,
            // but not yet "forgotten") — still shown so local history stays reachable,
            // but should read as disconnected rather than an active partner.
            const isUnpairedPartner =
              !!contact.partner_user_id &&
              !partners.some((p) => p.id === contact.partner_user_id && p.status === 'active');

            return (
              <ContactPill
                key={contact.id}
                name={contact.nickname ?? contact.name}
                emoji={contact.avatar_emoji}
                color={contact.color}
                active={!soloModeActive && contact.id === activeContactId}
                unpaired={isUnpairedPartner}
                unpairedLabel={t('settings.unpaired')}
                onPress={() => setActiveContact(contact.id)}
              />
            );
          })}
        </ScrollView>

        {!soloModeActive && contacts.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>💝</Text>
            <Text style={[styles.emptyTitle, { color: c.text }]}>{t('onboarding.addFirst')}</Text>
            <TouchableOpacity
              style={[styles.startBtn, { backgroundColor: c.primary }]}
              onPress={() => router.push('/modal/add-contact')}
            >
              <Text style={styles.startBtnText}>{t('contacts.addContact')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Poke Section */}
            {activePartner && (
              <View style={[styles.section, { marginTop: 10 }]}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>{t('poke.sendTitle').toUpperCase()}</Text>
                  <Text style={[styles.partnerName, { color: c.primary }]}>
                    {activePartner.alias}
                  </Text>
                </View>
                <View style={styles.pokeGrid}>
                  {pokeSlots.map((slot, idx) => (
                    <TouchableOpacity
                      key={`${slot.key}-${idx}`}
                      disabled={isSendingPoke}
                      onPress={() => handleSendPoke(slot)}
                      style={[styles.pokeBtn, { backgroundColor: c.surface, borderColor: c.border, opacity: isSendingPoke ? 0.6 : 1 }]}
                    >
                      <Text style={{ fontSize: 24 }}>{slot.emoji}</Text>
                      <Text style={[styles.pokeBtnLabel, { color: c.textSecondary }]}>
                        {slot.customLabel ?? t(`poke.messages.${slot.key}`)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Quick Log Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>{t('home.quickLog').toUpperCase()}</Text>
              <Text style={[styles.sectionHint, { color: c.textMuted }]}>{t('home.tapToLog')}</Text>
              <View style={styles.eventGrid}>
                {EVENT_TYPES.map((et) => (
                  <EventButton
                    key={et.key}
                    icon={et.icon}
                    label={t(et.labelKey)}
                    color={et.color}
                    bgColor={et.bgColor}
                    onPress={() => handleQuickLog(et.key)}
                    onLongPress={() => handleLongPress(et.key)}
                  />
                ))}
              </View>
            </View>

            {/* Recent Events */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>{t('home.recentEvents').toUpperCase()}</Text>
              {recentEvents.length === 0 ? (
                <Text style={[styles.emptyText, { color: c.textMuted }]}>{t('home.noRecentEvents')}</Text>
              ) : (
                recentEvents.map((e, idx) => <RecentEventRow key={e.id || `recent-${idx}`} event={e} />)
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  appTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  addBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  pillsRow: { marginBottom: 12 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
  },
  pillText: { fontSize: 13, fontWeight: '600' },
  notifBtn: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
  },
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
  sectionHint: { fontSize: 12, marginBottom: 12 },
  eventGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  eventBtn: {
    borderRadius: 16, padding: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  eventBtnRing: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  eventBtnIcon: { fontSize: 26 },
  eventBtnLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  recentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8,
  },
  recentIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  recentType: { fontSize: 13, fontWeight: '700' },
  recentNote: { fontSize: 12, marginTop: 2 },
  recentTime: { fontSize: 12 },
  emptyCard: {
    margin: 20, borderRadius: 20, borderWidth: 1,
    padding: 32, alignItems: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 24 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  startBtn: { paddingVertical: 12, paddingHorizontal: 28, borderRadius: 24 },
  startBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  partnerName: {
    fontSize: 14,
    fontWeight: '700',
  },
  pokeGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  pokeBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }
    }),
  },
  pokeBtnLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
  },
});
