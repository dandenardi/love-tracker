import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTheme } from '@/context/ThemeContext';
import { useContactsStore } from '@/store/useContactsStore';
import { useEventsStore } from '@/store/useEventsStore';
import { EVENT_TYPE_MAP } from '@/constants/eventTypes';
import { type LoveEvent } from '@/types/shared';

export default function CalendarScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const activeContactId = useContactsStore((s) => s.activeContactId);
  const events = useEventsStore((s) => s.events); // Watch events for refresh
  const getDayEvents = useEventsStore((s) => s.getDayEvents);
  const getMonthEvents = useEventsStore((s) => s.getMonthEvents);

  const today = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });
  const [showDayModal, setShowDayModal] = useState(false);
  const [monthEvents, setMonthEvents] = useState<LoveEvent[]>([]);
  const [dayEvents, setDayEvents] = useState<LoveEvent[]>([]);

  // Fetch month events when month or active contact changes
  useEffect(() => {
    if (!activeContactId) return;
    getMonthEvents(activeContactId, currentMonth.year, currentMonth.month)
      .then(setMonthEvents)
      .catch(console.error);
  }, [activeContactId, currentMonth, events, getMonthEvents]);

  // Fetch day events when selected date changes
  useEffect(() => {
    if (!activeContactId || !selectedDate) {
      setDayEvents([]);
      return;
    }
    getDayEvents(activeContactId, new Date(selectedDate + 'T12:00:00').getTime())
      .then(setDayEvents)
      .catch(console.error);
  }, [activeContactId, selectedDate, events, getDayEvents]);

  // Build marked dates for current month
  const markedDates = useMemo(() => {
    if (!activeContactId) return {};
    const marks: Record<string, any> = {};
    for (const ev of monthEvents) {
      const dateStr = format(new Date(ev.occurred_at), 'yyyy-MM-dd');
      const cfg = EVENT_TYPE_MAP[ev.type as keyof typeof EVENT_TYPE_MAP];
      if (!marks[dateStr]) marks[dateStr] = { dots: [], marked: true };
      const dotColor = cfg?.color ?? c.primary;
      const alreadyHas = marks[dateStr].dots.some((d: any) => d.color === dotColor);
      if (!alreadyHas) marks[dateStr].dots.push({ color: dotColor, selectedDotColor: dotColor });
    }
    if (selectedDate) {
      marks[selectedDate] = {
        ...marks[selectedDate],
        selected: true,
        selectedColor: c.primary + '55',
      };
    }
    return marks;
  }, [activeContactId, monthEvents, selectedDate, c.primary]);


  const handleDayPress = useCallback((day: any) => {
    setSelectedDate(day.dateString);
    setShowDayModal(true);
  }, []);

  const calendarTheme = {
    backgroundColor: c.background,
    calendarBackground: c.surface,
    textSectionTitleColor: c.textMuted,
    selectedDayBackgroundColor: c.primary,
    selectedDayTextColor: '#FFF',
    todayTextColor: c.primary,
    dayTextColor: c.text,
    textDisabledColor: c.textMuted + '66',
    dotColor: c.primary,
    monthTextColor: c.text,
    arrowColor: c.primary,
    indicatorColor: c.primary,
    textDayFontWeight: '500',
    textMonthFontWeight: '700',
    textDayHeaderFontWeight: '600',
    textDayFontSize: 14,
    textMonthFontSize: 16,
    textDayHeaderFontSize: 12,
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>📅 {t('calendar.title')}</Text>
      </View>

      <Calendar
        theme={calendarTheme as any}
        markingType="multi-dot"
        markedDates={markedDates}
        onDayPress={handleDayPress}
        onMonthChange={(month: any) => {
          setCurrentMonth({ year: month.year, month: month.month - 1 });
        }}
        style={[styles.calendar, { borderColor: c.border }]}
        enableSwipeMonths
      />

      {/* Day Events Modal */}
      <Modal visible={showDayModal} animationType="slide" transparent onRequestClose={() => setShowDayModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowDayModal(false)}>
          <View style={[styles.modalSheet, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={[styles.sheetHandle, { backgroundColor: c.border }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: c.text }]}>
                {selectedDate ? (() => {
                  const [y, m, d] = selectedDate.split('-').map(Number);
                  const dateObj = new Date(y, m - 1, d);
                  return format(dateObj, 'MMMM d, yyyy', { locale: i18n.language === 'pt' ? ptBR : undefined });
                })() : ''}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowDayModal(false);
                  router.push({ pathname: '/modal/log-event', params: { date: selectedDate || '', contactId: activeContactId || '' } });
                }}
                style={[styles.addEventBtn, { backgroundColor: c.primary + '15' }]}
              >
                <Text style={{ color: c.primary, fontWeight: '700', fontSize: 13 }}>＋ {t('calendar.addEvent')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {dayEvents.length === 0 ? (
                <Text style={[styles.emptyText, { color: c.textMuted }]}>{t('calendar.noEvents')}</Text>
              ) : (
                dayEvents.map((ev) => {
                  const cfg = EVENT_TYPE_MAP[ev.type as keyof typeof EVENT_TYPE_MAP];
                  return (
                    <TouchableOpacity
                      key={ev.id}
                      onPress={() => {
                        setShowDayModal(false);
                        router.push({ pathname: '/modal/event-detail', params: { id: ev.id } });
                      }}
                      style={[styles.eventRow, { backgroundColor: cfg?.bgColor ?? c.surfaceAlt, borderColor: (cfg?.color ?? c.border) + '44' }]}
                    >
                      <Text style={{ fontSize: 22 }}>{cfg?.icon ?? '📝'}</Text>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.eventType, { color: cfg?.color ?? c.text }]}>{t(cfg?.labelKey ?? 'events.custom')}</Text>
                          {ev.is_private === 1 && (
                            <Text style={[styles.privatePill, { borderColor: '#A78BFA', color: '#A78BFA' }]}>🔒</Text>
                          )}
                        </View>
                        {ev.title && <Text style={[styles.eventNote, { color: c.textSecondary }]}>{ev.title}</Text>}
                        {ev.note && <Text style={[styles.eventNote, { color: c.textSecondary }]}>{ev.note}</Text>}
                      </View>
                      <Text style={[styles.eventTime, { color: c.textMuted }]}>
                        {format(new Date(ev.occurred_at), 'HH:mm')}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '800' },
  calendar: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
  modalSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderBottomWidth: 0,
    padding: 20, minHeight: 300, maxHeight: '70%',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  addEventBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  emptyText: { textAlign: 'center', paddingVertical: 32 },
  eventRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10,
  },
  eventType: { fontSize: 14, fontWeight: '700' },
  eventNote: { fontSize: 13, marginTop: 2 },
  eventTime: { fontSize: 12 },
  privatePill: { fontSize: 11, fontWeight: '700', borderWidth: 1, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden' },
});
