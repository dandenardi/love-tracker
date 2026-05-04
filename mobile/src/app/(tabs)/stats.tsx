import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useContactsStore } from '@/store/useContactsStore';
import { useEventsStore } from '@/store/useEventsStore';
import { EVENT_TYPES, EVENT_TYPE_MAP } from '@/constants/eventTypes';
import { getEventCountByType, getDaysSinceLast } from '@/db/events';

import { isValid } from 'date-fns';

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={[styles.statCard, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: c.textSecondary }]}>{label}</Text>
      {sub ? <Text style={[styles.statSub, { color: c.textMuted }]}>{sub}</Text> : null}
    </View>
  );
}

function TypeBar({ icon, label, count, max, color }: { icon: string; label: string; count: number; max: number; color: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const pct = max > 0 ? count / max : 0;
  return (
    <View style={styles.barRow}>
      <Text style={{ fontSize: 18, width: 30 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
        </View>
        <Text style={[styles.barLabel, { color: c.textSecondary }]}>{label}</Text>
      </View>
      <Text style={[styles.barCount, { color }]}>{count}</Text>
    </View>
  );
}

function DaysSinceRow({ icon, label, days, color }: { icon: string; label: string; days: number | null; color: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useTranslation();
  return (
    <View style={[styles.sinceRow, { borderColor: c.border }]}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={[styles.sinceLabel, { color: c.textSecondary, flex: 1 }]}>{label}</Text>
      <Text style={[styles.sinceValue, { color: days === null ? c.textMuted : color }]}>
        {days === null ? t('stats.never') : `${days}d`}
      </Text>
    </View>
  );
}

export default function StatsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t, i18n } = useTranslation();

  const activeContactId = useContactsStore((s) => s.activeContactId);
  const events = useEventsStore((s) => s.events);

  const { countByType, totalEvents, daysSince } = useMemo(() => {
    if (!activeContactId) return { countByType: {}, totalEvents: 0, daysSince: {} };
    try {
      const countByType = getEventCountByType(activeContactId);
      const totalEvents = Object.values(countByType).reduce((a, b) => (a || 0) + (b || 0), 0);
      const daysSince: Record<string, number | null> = {};
      for (const et of EVENT_TYPES) {
        daysSince[et.key] = getDaysSinceLast(activeContactId, et.key);
      }
      return { countByType, totalEvents, daysSince };
    } catch (err) {
      console.error('[Stats] Error calculating stats:', err);
      return { countByType: {}, totalEvents: 0, daysSince: {} };
    }
  }, [activeContactId, events]);

  const maxCount = Math.max(...Object.values(countByType), 1);

  const thisMonthCount = useMemo(() => {
    if (!events) return 0;
    const now = new Date();
    return events.filter((e) => {
      if (!e.occurred_at) return false;
      const d = new Date(e.occurred_at);
      if (!isValid(d)) return false;
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [events]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text }]}>📊 {t('stats.title')}</Text>
        </View>

        {/* Summary Cards */}
        <View style={styles.cardRow}>
          <StatCard label={t('stats.totalEvents')} value={totalEvents} color={c.primary} />
          <StatCard
            label={t('stats.thisMonth')}
            value={thisMonthCount}
            color={c.accent}
          />
        </View>

        {/* By Type Distribution */}
        <View style={[styles.section, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>{t('stats.byType').toUpperCase()}</Text>
          {EVENT_TYPES.map((et) => (
            <TypeBar
              key={et.key}
              icon={et.icon}
              label={t(et.labelKey)}
              count={countByType[et.key] ?? 0}
              max={maxCount}
              color={et.color}
            />
          ))}
        </View>

        {/* Days Since Last */}
        <View style={[styles.section, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>{t('stats.daysSince').toUpperCase()}</Text>
          {EVENT_TYPES.filter((et) => et.key !== 'CUSTOM').map((et) => (
            <DaysSinceRow
              key={et.key}
              icon={et.icon}
              label={t(et.labelKey)}
              days={daysSince[et.key] ?? null}
              color={et.color}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '800' },
  cardRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1, borderRadius: 16, borderWidth: 1,
    padding: 16, alignItems: 'center',
  },
  statValue: { fontSize: 36, fontWeight: '800' },
  statLabel: { fontSize: 12, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  statSub: { fontSize: 11, marginTop: 2 },
  section: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 16 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: '#FFFFFF11', marginBottom: 4 },
  barFill: { height: 8, borderRadius: 4 },
  barLabel: { fontSize: 12 },
  barCount: { fontSize: 15, fontWeight: '700', width: 32, textAlign: 'right' },
  sinceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 0.5 },
  sinceLabel: { fontSize: 13 },
  sinceValue: { fontSize: 15, fontWeight: '700' },
});
