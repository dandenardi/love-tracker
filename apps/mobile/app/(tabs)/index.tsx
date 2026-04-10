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
  name, emoji, color, active, onPress,
}: {
  name: string; emoji: string; color: string; active: boolean; onPress: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <TouchableOpacity
      style={[
        styles.pill,
        {
          backgroundColor: active ? color + '30' : c.surface,
          borderColor: active ? color : c.border,
        },
      ]}
      onPress={onPress}
    >
      <Text style={{ fontSize: 16 }}>{emoji}</Text>
      <Text style={[styles.pillText, { color: active ? color : c.textSecondary }]}>{name}</Text>
    </TouchableOpacity>
  );
}

// ── Recent Event Row ────────────────────────────────────────────────────────
function RecentEventRow({ event }: { event: any }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const cfg = EVENT_TYPE_MAP[event.type as keyof typeof EVENT_TYPE_MAP];
  const { t } = useTranslation();
  return (
    <View style={[styles.recentRow, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={[styles.recentIconWrap, { backgroundColor: cfg?.bgColor ?? c.surfaceAlt }]}>
        <Text style={{ fontSize: 18 }}>{cfg?.icon ?? '📝'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.recentType, { color: cfg?.color ?? c.text }]}>
          {t(cfg?.labelKey ?? 'events.custom')}
        </Text>
        {event.note ? (
          <Text style={[styles.recentNote, { color: c.textSecondary }]} numberOfLines={1}>
            {event.note}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.recentTime, { color: c.textMuted }]}>
        {format(new Date(event.occurred_at), 'HH:mm')}
      </Text>
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
  const setActiveContact = useContactsStore((s) => s.setActiveContact);
  const activeContact = useContactsStore((s) => s.activeContact());

  const events = useEventsStore((s) => s.events);
  const loadEvents = useEventsStore((s) => s.loadEvents);
  const logEvent = useEventsStore((s) => s.logEvent);

  useEffect(() => {
    if (activeContactId) loadEvents(activeContactId);
  }, [activeContactId]);

  const handleQuickLog = useCallback(
    async (typeKey: string) => {
      if (!activeContactId) {
        Alert.alert(t('contacts.noContacts'), t('contacts.addContact'));
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      logEvent({
        contact_id: activeContactId,
        type: typeKey as any,
        intensity: 0,
        occurred_at: Date.now(),
      });
    },
    [activeContactId, logEvent, t]
  );

  const handleLongPress = useCallback(
    (typeKey: string) => {
      router.push({ pathname: '/modal/log-event', params: { type: typeKey, contactId: activeContactId ?? '' } });
    },
    [activeContactId, router]
  );

  const recentEvents = events.slice(0, 5);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.appTitle, { color: c.text }]}>💞 Love Tracker</Text>
          <TouchableOpacity onPress={() => router.push('/modal/add-contact')}>
            <View style={[styles.addBtn, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={{ fontSize: 20, color: c.primary }}>＋</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Contact Pills */}
        {contacts.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsRow} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
            {contacts.map((contact) => (
              <ContactPill
                key={contact.id}
                name={contact.nickname ?? contact.name}
                emoji={contact.avatar_emoji}
                color={contact.color}
                active={contact.id === activeContactId}
                onPress={() => setActiveContact(contact.id)}
              />
            ))}
          </ScrollView>
        )}

        {contacts.length === 0 ? (
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
                recentEvents.map((e) => <RecentEventRow key={e.id} event={e} />)
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
});
