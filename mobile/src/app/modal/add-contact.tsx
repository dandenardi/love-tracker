import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useContactsStore } from '@/store/useContactsStore';

const AVATAR_OPTIONS = ['👤','❤️','💕','🌹','💎','🦋','🌙','⭐','🔥','💋','🎭','🌊'];
const COLOR_OPTIONS = ['#E85D75','#F4A261','#4ECDC4','#A855F7','#74B49B','#45B7D1','#FFD166','#FF6B6B','#818CF8','#F97316'];

export default function AddContactModal() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useTranslation();
  const router = useRouter();
  const { addContact, setActiveContact } = useContactsStore();

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('❤️');
  const [color, setColor] = useState(c.primary);

  const handleSave = async () => {
    if (!name.trim()) return;
    const contact = await addContact({
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      avatar_emoji: avatar,
      color,
      is_partner: 0,
    });
    setActiveContact(contact.id);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const handleCancel = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={handleCancel}>
            <Text style={[styles.headerBtn, { color: c.textSecondary }]}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: c.text }]}>{t('contacts.addContact')}</Text>
          <TouchableOpacity onPress={handleSave} disabled={!name.trim()}>
            <Text style={[styles.headerBtn, { color: name.trim() ? c.primary : c.textMuted, fontWeight: '700' }]}>{t('common.save')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Preview */}
          <View style={styles.preview}>
            <View style={[styles.avatarCircle, { backgroundColor: color + '30', borderColor: color }]}>
              <Text style={{ fontSize: 48 }}>{avatar}</Text>
            </View>
            <Text style={[styles.previewName, { color: c.text }]}>{name || '...'}</Text>
          </View>

          {/* Name */}
          <Text style={[styles.label, { color: c.textSecondary }]}>{t('contacts.name').toUpperCase()}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            value={name}
            onChangeText={setName}
            placeholder={t('contacts.namePlaceholder')}
            placeholderTextColor={c.textMuted}
            autoFocus
          />

          {/* Nickname */}
          <Text style={[styles.label, { color: c.textSecondary }]}>{t('contacts.nickname').toUpperCase()}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            value={nickname}
            onChangeText={setNickname}
            placeholder="Short name shown in pills..."
            placeholderTextColor={c.textMuted}
          />

          {/* Avatar */}
          <Text style={[styles.label, { color: c.textSecondary }]}>{t('contacts.avatar').toUpperCase()}</Text>
          <View style={styles.optionRow}>
            {AVATAR_OPTIONS.map((em) => (
              <TouchableOpacity
                key={em}
                onPress={() => setAvatar(em)}
                style={[styles.avatarOption, { borderColor: avatar === em ? color : c.border, backgroundColor: avatar === em ? color + '20' : c.surface }]}
              >
                <Text style={{ fontSize: 24 }}>{em}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Color */}
          <Text style={[styles.label, { color: c.textSecondary }]}>{t('contacts.color').toUpperCase()}</Text>
          <View style={styles.optionRow}>
            {COLOR_OPTIONS.map((col) => (
              <TouchableOpacity
                key={col}
                onPress={() => setColor(col)}
                style={[styles.colorOption, { backgroundColor: col, borderWidth: color === col ? 3 : 1.5, borderColor: color === col ? '#FFF' : col }]}
              />
            ))}
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
  scroll: { padding: 24, paddingBottom: 48 },
  preview: { alignItems: 'center', marginBottom: 32 },
  avatarCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  previewName: { fontSize: 20, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 10, marginTop: 20 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  avatarOption: { width: 52, height: 52, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  colorOption: { width: 36, height: 36, borderRadius: 18 },
});
