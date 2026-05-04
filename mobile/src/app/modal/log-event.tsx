import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Switch, Keyboard, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DateTimePickerWrapper } from '@/components/DateTimePickerWrapper';
import { useTheme } from '@/context/ThemeContext';
import { useEventsStore } from '@/store/useEventsStore';
import { useContactsStore } from '@/store/useContactsStore';
import { EVENT_TYPES, MOOD_TAGS, EVENT_TYPE_MAP } from '@/constants/eventTypes';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function LogEventModal() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; contactId?: string; date?: string }>();

  const logEvent = useEventsStore((s) => s.logEvent);
  const activeContactId = useContactsStore((s) => s.activeContactId);

  const contactId = params.contactId || activeContactId || '';
  const [selectedType, setSelectedType] = useState(params.type ?? 'SPECIAL');
  const [note, setNote] = useState('');
  const [title, setTitle] = useState('');

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const [intensity, setIntensity] = useState(0);
  const [moodTag, setMoodTag] = useState<string | null>(null);
  
  // Initialize date from param if present (format: yyyy-MM-dd)
  const initialDate = params.date ? new Date(params.date + 'T12:00:00') : new Date();
  const [occurredAt, setOccurredAt] = useState(initialDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  const cfg = EVENT_TYPE_MAP[selectedType as keyof typeof EVENT_TYPE_MAP];

  const handleSave = async () => {
    if (!contactId) {
      Alert.alert(t('common.error'), t('contacts.noContacts'));
      return;
    }

    try {
      Keyboard.dismiss();
      await logEvent({
        contact_id: contactId,
        type: selectedType as any,
        title: selectedType === 'CUSTOM' ? title : undefined,
        note: note || undefined,
        intensity,
        mood_tag: moodTag ?? undefined,
        occurred_at: occurredAt.getTime(),
        is_private: isPrivate ? 1 : 0,
      });
      handleBack();
    } catch (err) {
      console.error('[LogEvent] Error saving event:', err);
      Alert.alert(t('common.error'), 'Failed to save event. Please try again.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'android' ? 64 : 0}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={handleBack}>
            <Text style={[styles.headerBtn, { color: c.textSecondary }]}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: c.text }]}>{t('events.logEvent')}</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={[styles.headerBtn, { color: c.primary, fontWeight: '700' }]}>{t('common.save')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Event Type Picker */}
          <Text style={[styles.label, { color: c.textSecondary }]}>{t('events.chooseType').toUpperCase()}</Text>
          <View style={styles.typeGrid}>
            {EVENT_TYPES.map((et) => (
              <TouchableOpacity
                key={et.key}
                onPress={() => setSelectedType(et.key)}
                style={[
                  styles.typeBtn,
                  { backgroundColor: et.bgColor, borderColor: selectedType === et.key ? et.color : 'transparent' },
                ]}
              >
                <Text style={{ fontSize: 26 }}>{et.icon}</Text>
                <Text style={[styles.typeBtnLabel, { color: et.color }]}>{t(et.labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom title */}
          {selectedType === 'CUSTOM' && (
            <>
              <Text style={[styles.label, { color: c.textSecondary }]}>TITLE</Text>
              <TextInput
                style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
                value={title}
                onChangeText={setTitle}
                placeholder="Event title..."
                placeholderTextColor={c.textMuted}
              />
            </>
          )}

          {/* Note */}
          <Text style={[styles.label, { color: c.textSecondary }]}>{t('events.note').toUpperCase()}</Text>
          <TextInput
            style={[styles.input, styles.noteInput, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            value={note}
            onChangeText={setNote}
            placeholder={t('events.notePlaceholder')}
            placeholderTextColor={c.textMuted}
            multiline
            textAlignVertical="top"
          />

          {/* Date & Time */}
          <Text style={[styles.label, { color: c.textSecondary }]}>{t('events.dateTime').toUpperCase()}</Text>
          <TouchableOpacity
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ color: c.text, fontSize: 14 }}>
              {format(occurredAt, 'PPpp', { locale: i18n.language === 'pt' ? ptBR : undefined })}
            </Text>
            <Text style={{ color: c.primary }}>✏️</Text>
          </TouchableOpacity>
          <DateTimePickerWrapper
            value={occurredAt}
            show={showDatePicker}
            onChange={(date) => setOccurredAt(date)}
            onClose={() => setShowDatePicker(false)}
          />

          {/* Intensity */}
          <Text style={[styles.label, { color: c.textSecondary }]}>{t('events.intensity').toUpperCase()}</Text>
          <View style={styles.intensityRow}>
            {[0,1,2,3,4,5].map((i) => (
              <TouchableOpacity key={i} onPress={() => setIntensity(i)} style={[
                styles.intensityBtn,
                { backgroundColor: i <= intensity && i > 0 ? ((cfg?.color ?? c.primary) + '40') : c.surface, borderColor: i <= intensity && i > 0 ? cfg?.color ?? c.primary : c.border }
              ]}>
                <Text style={{ color: i <= intensity && i > 0 ? cfg?.color ?? c.primary : c.textMuted, fontWeight: '700' }}>
                  {i === 0 ? '—' : i}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Mood */}
          <Text style={[styles.label, { color: c.textSecondary }]}>{t('events.mood').toUpperCase()}</Text>
          <View style={styles.moodRow}>
            {MOOD_TAGS.map((m) => (
              <TouchableOpacity
                key={m.key}
                onPress={() => setMoodTag(moodTag === m.emoji ? null : m.emoji)}
                style={[styles.moodBtn, { backgroundColor: moodTag === m.emoji ? c.primary + '30' : c.surface, borderColor: moodTag === m.emoji ? c.primary : c.border }]}
              >
                <Text style={{ fontSize: 22 }}>{m.emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Privacy Toggle */}
          <View style={[styles.privacyRow, { backgroundColor: c.surface, borderColor: isPrivate ? '#A78BFA' : c.border }]}>
            <View style={styles.privacyLeft}>
              <Text style={{ fontSize: 20 }}>🔒</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.privacyLabel, { color: c.text }]}>{t('events.private')}</Text>
                <Text style={[styles.privacyDesc, { color: c.textMuted }]}>{t('events.privateDesc')}</Text>
              </View>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: c.border, true: '#A78BFA' }}
              thumbColor={isPrivate ? '#7C3AED' : c.textMuted}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerBtn: { fontSize: 15 },
  scroll: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 10, marginTop: 20 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeBtn: { width: '30%', padding: 12, borderRadius: 14, alignItems: 'center', borderWidth: 2 },
  typeBtnLabel: { fontSize: 11, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14 },
  noteInput: { minHeight: 100 },
  intensityRow: { flexDirection: 'row', gap: 8 },
  intensityBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moodBtn: { width: 52, height: 52, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  privacyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderRadius: 16, padding: 14, marginTop: 20, gap: 12,
  },
  privacyLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  privacyLabel: { fontSize: 14, fontWeight: '700' },
  privacyDesc: { fontSize: 11, marginTop: 2 },
});
