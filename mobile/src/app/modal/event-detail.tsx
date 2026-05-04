import { EVENT_TYPE_MAP, MOOD_TAGS } from "@/constants/eventTypes";
import { useTheme } from "@/context/ThemeContext";
import { useEventsStore } from "@/store/useEventsStore";
import { DateTimePickerWrapper } from "@/components/DateTimePickerWrapper";
import { format } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ptBR } from 'date-fns/locale';

export default function EventDetailModal() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();

  const events = useEventsStore((s) => s.events);
  const editEvent = useEventsStore((s) => s.editEvent);
  const removeEvent = useEventsStore((s) => s.removeEvent);

  const event = events.find((e) => e.id === params.id);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  const [note, setNote] = useState(event?.note || "");
  const [intensity, setIntensity] = useState(event?.intensity || 0);
  const [moodTag, setMoodTag] = useState<string | null>(
    event?.mood_tag || null,
  );
  const [occurredAt, setOccurredAt] = useState(
    new Date(event?.occurred_at || Date.now()),
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isPrivate, setIsPrivate] = useState((event?.is_private ?? 0) === 1);

  if (!event) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: c.background,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <Text style={{ color: c.text }}>{t("common.noData")}</Text>
        <TouchableOpacity onPress={handleBack}>
          <Text style={{ color: c.primary, marginTop: 16 }}>
            {t("common.back")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cfg = EVENT_TYPE_MAP[event.type as keyof typeof EVENT_TYPE_MAP];

  const handleSave = async () => {
    Keyboard.dismiss();
    await editEvent(event.id, {
      note: note || undefined,
      intensity,
      mood_tag: moodTag || undefined,
      occurred_at: occurredAt.getTime(),
      is_private: isPrivate ? 1 : 0,
    });
    handleBack();
  };

  const handleDelete = () => {
    Alert.alert(t("events.deleteEvent"), t("events.deleteConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          await removeEvent(event.id);
          handleBack();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "android" ? 64 : 0}
      >
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={handleBack}>
            <Text style={[styles.headerBtn, { color: c.textSecondary }]}>
              {t("common.close")}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: c.text }]}>
            {t("events.editEvent")}
          </Text>
          <TouchableOpacity onPress={handleSave}>
            <Text
              style={[
                styles.headerBtn,
                { color: c.primary, fontWeight: "700" },
              ]}
            >
              {t("common.done")}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Event Header Info */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: cfg?.bgColor || c.surface,
                borderColor: cfg?.color || c.border,
              },
            ]}
          >
            <Text style={{ fontSize: 48 }}>{cfg?.icon || "📝"}</Text>
            <Text style={[styles.infoType, { color: cfg?.color || c.text }]}>
              {t(cfg?.labelKey || "events.custom")}
            </Text>
            <Text style={[styles.infoLogged, { color: c.textMuted }]}>
              {t("events.loggedAt")}:{" "}
              {format(new Date(event.logged_at), "PPpp")}
            </Text>
            {event.is_private === 1 && (
              <View style={styles.privateBadge}>
                <Text style={styles.privateBadgeText}>
                  🔒 {t("events.privateBadge")}
                </Text>
              </View>
            )}
          </View>

          {/* Date & Time */}
          <Text style={[styles.label, { color: c.textSecondary }]}>
            {t("events.dateTime").toUpperCase()}
          </Text>
          <TouchableOpacity
            style={[
              styles.input,
              {
                backgroundColor: c.surface,
                borderColor: c.border,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              },
            ]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ color: c.text, fontSize: 14 }}>
              {format(occurredAt, "PPpp")}
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
          <Text style={[styles.label, { color: c.textSecondary }]}>
            {t("events.intensity").toUpperCase()}
          </Text>
          <View style={styles.intensityRow}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setIntensity(i)}
                style={[
                  styles.intensityBtn,
                  {
                    backgroundColor:
                      i <= intensity && i > 0
                        ? (cfg?.color ?? c.primary) + "40"
                        : c.surface,
                    borderColor:
                      i <= intensity && i > 0
                        ? (cfg?.color ?? c.primary)
                        : c.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color:
                      i <= intensity && i > 0
                        ? cfg?.color || c.primary
                        : c.textMuted,
                    fontWeight: "700",
                  }}
                >
                  {i === 0 ? "—" : i}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Mood */}
          <Text style={[styles.label, { color: c.textSecondary }]}>
            {t("events.mood").toUpperCase()}
          </Text>
          <View style={styles.moodRow}>
            {MOOD_TAGS.map((m) => (
              <TouchableOpacity
                key={m.key}
                onPress={() => setMoodTag(moodTag === m.emoji ? null : m.emoji)}
                style={[
                  styles.moodBtn,
                  {
                    backgroundColor:
                      moodTag === m.emoji ? c.primary + "30" : c.surface,
                    borderColor: moodTag === m.emoji ? c.primary : c.border,
                  },
                ]}
              >
                <Text style={{ fontSize: 22 }}>{m.emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Note */}
          <Text style={[styles.label, { color: c.textSecondary }]}>
            {t("events.note").toUpperCase()}
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.noteInput,
              {
                backgroundColor: c.surface,
                borderColor: c.border,
                color: c.text,
              },
            ]}
            value={note}
            onChangeText={setNote}
            placeholder={t("events.notePlaceholder")}
            placeholderTextColor={c.textMuted}
            multiline
            textAlignVertical="top"
          />

          {/* Privacy Toggle */}
          <View
            style={[
              styles.privacyRow,
              {
                backgroundColor: c.surface,
                borderColor: isPrivate ? "#A78BFA" : c.border,
              },
            ]}
          >
            <View style={styles.privacyLeft}>
              <Text style={{ fontSize: 20 }}>🔒</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.privacyLabel, { color: c.text }]}>
                  {t("events.private")}
                </Text>
                <Text style={[styles.privacyDesc, { color: c.textMuted }]}>
                  {t("events.privateDesc")}
                </Text>
              </View>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: c.border, true: "#A78BFA" }}
              thumbColor={isPrivate ? "#7C3AED" : c.textMuted}
            />
          </View>

          {/* Delete Button */}
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>{t("events.deleteEvent")}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  headerBtn: { fontSize: 15 },
  scroll: { padding: 20, paddingBottom: 40 },
  infoCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 2,
    marginBottom: 8,
  },
  infoType: { fontSize: 22, fontWeight: "800", marginTop: 8 },
  infoLogged: { fontSize: 12, marginTop: 4 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 24,
  },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14 },
  noteInput: { minHeight: 100 },
  intensityRow: { flexDirection: "row", gap: 8 },
  intensityBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
  },
  moodRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  moodBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtn: {
    marginTop: 48,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F8717144",
    backgroundColor: "#F8717110",
  },
  deleteBtnText: { color: "#F87171", fontWeight: "700", fontSize: 15 },
  privateBadge: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "#7C3AED22",
    borderWidth: 1,
    borderColor: "#A78BFA",
  },
  privateBadgeText: { color: "#A78BFA", fontSize: 12, fontWeight: "700" },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginTop: 20,
    gap: 12,
  },
  privacyLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  privacyLabel: { fontSize: 14, fontWeight: "700" },
  privacyDesc: { fontSize: 11, marginTop: 2 },
});
