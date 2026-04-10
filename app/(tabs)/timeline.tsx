import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { format, isToday, isYesterday } from 'date-fns';
import { useTheme } from '@/context/ThemeContext';
import { useContactsStore } from '@/store/useContactsStore';
import { useEventsStore } from '@/store/useEventsStore';
import { EVENT_TYPE_MAP } from '@/constants/eventTypes';
import type { LoveEvent } from '@/db/events';

function groupEventsByDate(events: LoveEvent[]): { key: string; label: string; data: LoveEvent[] }[] {
  const groups: Record<string, LoveEvent[]> = {};
  for (const ev of events) {
    const dateStr = format(new Date(ev.occurred_at), 'yyyy-MM-dd');
    if (!groups[dateStr]) groups[dateStr] = [];
    groups[dateStr].push(ev);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateStr, data]) => {
      const d = new Date(dateStr + 'T12:00:00');
      let label = format(d, 'MMMM d, yyyy');
      return { key: dateStr, label, data };
    });
}

function IntensityDots({ value, color }: { value: number; color: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3, marginTop: 4 }}>
      {[1,2,3,4,5].map((i) => (
        <View key={i} style={{
          width: 6, height: 6, borderRadius: 3,
          backgroundColor: i <= value ? color : color + '30',
        }} />
      ))}
    </View>
  );
}

export default function TimelineScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useTranslation();
  const router = useRouter();

  const activeContactId = useContactsStore((s) => s.activeContactId);
  const events = useEventsStore((s) => s.events);
  const loadEvents = useEventsStore((s) => s.loadEvents);
  const removeEvent = useEventsStore((s) => s.removeEvent);

  useEffect(() => {
    if (activeContactId) loadEvents(activeContactId);
  }, [activeContactId]);

  const groups = groupEventsByDate(events);

  const handleDelete = (id: string) => {
    Alert.alert(t('events.deleteEvent'), t('events.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => removeEvent(id) },
    ]);
  };

  const renderItem = ({ item: ev }: { item: LoveEvent }) => {
    const cfg = EVENT_TYPE_MAP[ev.type as keyof typeof EVENT_TYPE_MAP];
    return (
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/modal/event-detail', params: { id: ev.id } })}
        onLongPress={() => handleDelete(ev.id)}
        style={[styles.card, { backgroundColor: cfg?.bgColor ?? c.surface, borderColor: (cfg?.color ?? c.border) + '44' }]}
        activeOpacity={0.85}
      >
        <View style={[styles.iconWrap, { backgroundColor: cfg?.color + '22' }]}>
          <Text style={{ fontSize: 24 }}>{cfg?.icon ?? '📝'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardType, { color: cfg?.color ?? c.text }]}>{t(cfg?.labelKey ?? 'events.custom')}</Text>
          {ev.title && <Text style={[styles.cardNote, { color: c.text }]}>{ev.title}</Text>}
          {ev.note && <Text style={[styles.cardNote, { color: c.textSecondary }]}>{ev.note}</Text>}
          {ev.mood_tag && <Text style={styles.moodTag}>{ev.mood_tag}</Text>}
          {ev.intensity > 0 && <IntensityDots value={ev.intensity} color={cfg?.color ?? c.primary} />}
        </View>
        <Text style={[styles.cardTime, { color: c.textMuted }]}>{format(new Date(ev.occurred_at), 'HH:mm')}</Text>
      </TouchableOpacity>
    );
  };

  const renderGroup = ({ item }: { item: { key: string; label: string; data: LoveEvent[] } }) => (
    <View>
      <Text style={[styles.dateLabel, { color: c.textMuted }]}>{item.label.toUpperCase()}</Text>
      {item.data.map((ev) => <View key={ev.id}>{renderItem({ item: ev })}</View>)}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>📋 {t('timeline.title')}</Text>
      </View>
      {groups.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 56 }}>🕊️</Text>
          <Text style={[styles.emptyText, { color: c.textMuted }]}>{t('timeline.noEvents')}</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.key}
          renderItem={renderGroup}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800' },
  dateLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: 20, marginBottom: 8, marginLeft: 4 },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 8,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardType: { fontSize: 13, fontWeight: '700' },
  cardNote: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  moodTag: { fontSize: 18, marginTop: 4 },
  cardTime: { fontSize: 12, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 15, textAlign: 'center' },
});
