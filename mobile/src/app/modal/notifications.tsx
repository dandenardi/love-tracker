import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { format, isToday, isYesterday, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTheme } from '@/context/ThemeContext';
import { useActivityStore, Activity } from '@/store/useActivityStore';
import { EVENT_TYPE_MAP } from '@/constants/eventTypes';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSyncStore } from '@/store/useSyncStore';

function safeFormat(timestamp: any, formatStr: string): string {
  try {
    const d = new Date(timestamp);
    if (!isValid(d)) return '--:--';
    return format(d, formatStr);
  } catch {
    return '--:--';
  }
}

function ActivityRow({ activity, onPress }: { activity: Activity; onPress: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useTranslation();
  const { userId } = useSyncStore();

  const isPoke = activity.type === 'poke';
  const isRead = !!activity.readAt;
  const isSent = activity.senderId === userId;

  if (isPoke) {
    console.log(`[ActivityRow] Poke ${activity.id}: isSent=${isSent}, senderId=${activity.senderId}, userId=${userId}`);
  }

  let body = activity.body;
  let icon = isPoke ? '💌' : '📝';
  let iconBg = c.surfaceAlt;
  let iconColor = c.primary;

  if (activity.type === 'event_added') {
    const et = EVENT_TYPE_MAP[activity.body as keyof typeof EVENT_TYPE_MAP];
    if (et) {
      body = t(`notifications.eventAdded`, { name: activity.title, type: t(et.labelKey) });
      icon = et.icon;
      iconBg = et.bgColor;
      iconColor = et.color;
    }
  } else if (isPoke) {
    if (isSent) {
      body = t('notifications.pokeSentTitle').replace('! ❤️', '') + ': ' + activity.body;
    } else {
      body = t(`notifications.pokeReceived`, { name: activity.title, emoji: '' }).replace(': ', '') + ': ' + activity.body;
    }
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.row,
        { backgroundColor: c.surface, borderBottomColor: c.border },
        !isRead && !isSent && { backgroundColor: c.primary + '08' }
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowTitle, { color: c.text }]}>{activity.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={[styles.rowTime, { color: c.textMuted }]}>
              {safeFormat(activity.timestamp, 'HH:mm')}
            </Text>
            {isPoke && isSent && (
              <MaterialCommunityIcons
                name={activity.pokeDeliveredAt ? "check-all" : "check"}
                size={14}
                color={activity.pokeReadAt ? "#34B7F1" : c.textMuted}
              />
            )}
          </View>
        </View>
        <Text style={[styles.rowBody, { color: c.textSecondary }]} numberOfLines={2}>
          {body}
        </Text>
      </View>
      {!isRead && !isSent && <View style={[styles.unreadDot, { backgroundColor: c.primary }]} />}
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const { activities, markAsRead, markAllAsRead, clearAll, loadActivities } = useActivityStore();
  const { userId } = useSyncStore();

  useEffect(() => {
    loadActivities();
  }, []);

  const groups = React.useMemo(() => {
    const g: Record<string, Activity[]> = { today: [], yesterday: [], earlier: [] };
    activities.forEach(a => {
      const d = new Date(a.timestamp);
      if (!isValid(d)) {
        g.earlier.push(a);
        return;
      }
      if (isToday(d)) g.today.push(a);
      else if (isYesterday(d)) g.yesterday.push(a);
      else g.earlier.push(a);
    });
    return g;
  }, [activities]);

  const renderSection = (title: string, data: Activity[]) => {
    if (data.length === 0) return null;
    const pokeStore = require('@/store/usePokeStore').usePokeStore.getState();

    return (
      <View>
        <Text style={[styles.sectionTitle, { color: c.textMuted }]}>{title.toUpperCase()}</Text>
        {data.map((item, idx) => (
          <ActivityRow
            key={item.id || `act-${idx}`}
            activity={item}
            onPress={() => {
              markAsRead(item.id);
              // If it's a RECEIVED poke, notify the server
              if (item.type === 'poke' && item.senderId !== userId) {
                pokeStore.markRead(item.id);
              }
            }}
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ color: c.primary, fontSize: 16, fontWeight: '600' }}>{t('common.close')}</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.text }]}>{t('notifications.title')}</Text>
        <TouchableOpacity onPress={clearAll} style={styles.clearBtn}>
          <Text style={{ color: c.error, fontSize: 14 }}>{t('notifications.clearAll')}</Text>
        </TouchableOpacity>
      </View>

      {activities.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 64, marginBottom: 16 }}>🔔</Text>
          <Text style={[styles.emptyText, { color: c.textMuted }]}>{t('notifications.noNotifications')}</Text>
        </View>
      ) : (
        <FlatList
          data={(['today', 'yesterday', 'earlier'] as const).filter(k => groups[k].length > 0)}
          keyExtractor={item => item}
          renderItem={({ item }) => {
            const label = t(`notifications.${item}`);
            return renderSection(label, groups[item]);
          }}
          contentContainerStyle={styles.list}
        />
      )}

      {activities.some(a => !a.readAt) && (
        <TouchableOpacity
          onPress={markAllAsRead}
          style={[styles.markAllBtn, { backgroundColor: c.primary }]}
        >
          <Text style={styles.markAllText}>{t('notifications.markRead')}</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { minWidth: 60 },
  clearBtn: { minWidth: 60, alignItems: 'flex-end' },
  title: { fontSize: 17, fontWeight: '700' },
  list: { paddingBottom: 100 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  rowTitle: { fontSize: 14, fontWeight: '700' },
  rowTime: { fontSize: 11 },
  rowBody: { fontSize: 13, lineHeight: 18 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 4,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 64,
  },
  emptyText: { fontSize: 16, fontWeight: '500' },
  markAllBtn: {
    position: 'absolute',
    bottom: 32,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
      android: { elevation: 8 },
    }),
  },
  markAllText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
});
