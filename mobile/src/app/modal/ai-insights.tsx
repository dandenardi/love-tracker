import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { useInsightsStore } from '@/store/useInsightsStore';
import { useSyncStore } from '@/store/useSyncStore';
import { useEventsStore } from '@/store/useEventsStore';
import { getMonthlyTeaser } from '@/services/teaserInsight';
import { InsightDomain } from '@/types/shared';
import { DateTimePickerWrapper } from '@/components/DateTimePickerWrapper';
import { PeriodPreset, periodPresetToRange } from '@/services/insightPeriod';

const CONFIDENCE_COLOR: Record<string, string> = {
  low: '#F4A261',
  medium: '#A78BFA',
  high: '#4ECDC4',
};

export default function AiInsightsModal() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const [optedIn, setOptedIn] = useState(false);
  const [domain, setDomain] = useState<InsightDomain>('solo');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all');
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);
  const [editingField, setEditingField] = useState<'from' | 'to' | null>(null);

  const responses = useInsightsStore((s) => s.responses);
  const loading = useInsightsStore((s) => s.loading);
  const fetchInsight = useInsightsStore((s) => s.fetchInsight);
  const setConsent = useInsightsStore((s) => s.setConsent);

  const partners = useSyncStore((s) => s.partners);
  const hasActivePartner = partners.some((p) => p.status === 'active');
  const events = useEventsStore((s) => s.events);
  const teaser = getMonthlyTeaser(events, t);

  const supportsPeriod = domain === 'solo' || domain === 'couple';

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  useEffect(() => {
    if (!optedIn) return;

    if (!supportsPeriod) {
      fetchInsight(domain, i18n.language);
      return;
    }

    if (periodPreset === 'custom' && (!customFrom || !customTo)) return; // wait for both dates

    const { from, to } = periodPresetToRange(periodPreset, customFrom, customTo);
    fetchInsight(domain, i18n.language, from, to);
  }, [optedIn, domain, periodPreset, customFrom, customTo]);

  const handleEnable = async () => {
    await setConsent(true);
    setOptedIn(true);
  };

  const response = responses[domain];

  const periodPresets: PeriodPreset[] = ['all', 'last30', 'last3Months', 'last6Months', 'custom'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Text style={{ color: c.primary, fontSize: 16 }}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.text }]}>{t('aiInsights.title')}</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {!optedIn ? (
          <View style={[styles.consentCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>✨</Text>
            <Text style={[styles.consentTitle, { color: c.text }]}>{t('aiInsights.consentTitle')}</Text>
            <Text style={[styles.consentBody, { color: c.textSecondary }]}>{t('aiInsights.consentBody')}</Text>
            <TouchableOpacity
              style={[styles.enableBtn, { backgroundColor: c.primary }]}
              onPress={handleEnable}
            >
              <Text style={styles.enableBtnText}>{t('aiInsights.enable')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.domainRow}>
              <TouchableOpacity
                style={[
                  styles.domainPill,
                  { backgroundColor: domain === 'solo' ? c.primary + '30' : c.surface, borderColor: domain === 'solo' ? c.primary : c.border },
                ]}
                onPress={() => setDomain('solo')}
              >
                <Text style={{ color: domain === 'solo' ? c.primary : c.textSecondary, fontWeight: '600' }}>
                  {t('aiInsights.domainSolo')}
                </Text>
              </TouchableOpacity>
              {hasActivePartner && (
                <TouchableOpacity
                  style={[
                    styles.domainPill,
                    { backgroundColor: domain === 'couple' ? c.primary + '30' : c.surface, borderColor: domain === 'couple' ? c.primary : c.border },
                  ]}
                  onPress={() => setDomain('couple')}
                >
                  <Text style={{ color: domain === 'couple' ? c.primary : c.textSecondary, fontWeight: '600' }}>
                    {t('aiInsights.domainCouple')}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.domainPill,
                  { backgroundColor: domain === 'profile' ? c.primary + '30' : c.surface, borderColor: domain === 'profile' ? c.primary : c.border },
                ]}
                onPress={() => setDomain('profile')}
              >
                <Text style={{ color: domain === 'profile' ? c.primary : c.textSecondary, fontWeight: '600' }}>
                  {t('aiInsights.domainProfile')}
                </Text>
              </TouchableOpacity>
            </View>

            {supportsPeriod && (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodRow} contentContainerStyle={{ gap: 8 }}>
                  {periodPresets.map((preset) => (
                    <TouchableOpacity
                      key={preset}
                      style={[
                        styles.periodPill,
                        { backgroundColor: periodPreset === preset ? c.primary + '20' : c.surface, borderColor: periodPreset === preset ? c.primary : c.border },
                      ]}
                      onPress={() => setPeriodPreset(preset)}
                    >
                      <Text style={{ color: periodPreset === preset ? c.primary : c.textMuted, fontSize: 12, fontWeight: '600' }}>
                        {t(`aiInsights.period.${preset}`)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {periodPreset === 'custom' && (
                  <View style={styles.customPeriodRow}>
                    <TouchableOpacity
                      style={[styles.periodPill, { backgroundColor: c.surface, borderColor: c.border }]}
                      onPress={() => setEditingField('from')}
                    >
                      <Text style={{ color: c.textSecondary, fontSize: 12 }}>
                        {t('aiInsights.period.from')}: {customFrom ? customFrom.toLocaleDateString() : '—'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.periodPill, { backgroundColor: c.surface, borderColor: c.border }]}
                      onPress={() => setEditingField('to')}
                    >
                      <Text style={{ color: c.textSecondary, fontSize: 12 }}>
                        {t('aiInsights.period.to')}: {customTo ? customTo.toLocaleDateString() : '—'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <DateTimePickerWrapper
                  value={(editingField === 'from' ? customFrom : customTo) ?? new Date()}
                  show={editingField !== null}
                  onClose={() => setEditingField(null)}
                  onChange={(date) => {
                    if (editingField === 'from') setCustomFrom(date);
                    else if (editingField === 'to') setCustomTo(date);
                  }}
                />
              </>
            )}

            {loading && !response ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} />
            ) : !response ? null : response.status === 'ok' ? (
              <View style={[styles.insightCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                <View style={styles.confidenceBadge}>
                  <View style={[styles.dot, { backgroundColor: CONFIDENCE_COLOR[response.insight.confidence] }]} />
                  <Text style={[styles.confidenceText, { color: c.textMuted }]}>
                    {t(`aiInsights.confidence.${response.insight.confidence}`)}
                  </Text>
                </View>
                <Text style={[styles.insightTitle, { color: c.text }]}>{response.insight.title}</Text>
                <Text style={[styles.insightBody, { color: c.textSecondary }]}>{response.insight.body}</Text>
                <Text style={[styles.evidenceText, { color: c.textMuted }]}>
                  {response.insight.evidenceRelationshipIds?.length
                    ? t('aiInsights.evidenceRelationshipCount', { count: response.insight.evidenceRelationshipIds.length })
                    : t('aiInsights.evidenceCount', { count: response.insight.evidenceEventIds.length })}
                </Text>
              </View>
            ) : response.status === 'not_enough_data' ? (
              <View style={[styles.emptyCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>📝</Text>
                <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                  {t('aiInsights.notEnoughData', { count: response.eventCount, threshold: response.threshold })}
                </Text>
              </View>
            ) : response.status === 'not_enough_relationships' ? (
              <View style={[styles.emptyCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>💞</Text>
                <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                  {t('aiInsights.notEnoughRelationships', { count: response.relationshipCount, threshold: response.threshold })}
                </Text>
              </View>
            ) : response.status === 'rate_limited' ? (
              <View style={[styles.emptyCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>⏳</Text>
                <Text style={[styles.emptyText, { color: c.textSecondary }]}>{t('aiInsights.rateLimited')}</Text>
              </View>
            ) : response.status === 'no_partner' ? (
              <View style={[styles.emptyCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={[styles.emptyText, { color: c.textSecondary }]}>{t('aiInsights.noPartner')}</Text>
              </View>
            ) : response.status === 'premium_required' ? (
              <>
                {teaser && (
                  <View style={[styles.teaserCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                    <Text style={{ fontSize: 24, marginBottom: 8 }}>{teaser.icon}</Text>
                    <Text style={[styles.teaserText, { color: c.textSecondary }]}>{teaser.text}</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.paywallCard, { backgroundColor: c.primary + '15', borderColor: c.primary }]}
                  onPress={() => router.push('/modal/paywall')}
                >
                  <Text style={{ fontSize: 28, marginBottom: 8 }}>🔓</Text>
                  <Text style={[styles.paywallTitle, { color: c.text }]}>{t('paywall.unlockTitle')}</Text>
                  <Text style={[styles.paywallBody, { color: c.textSecondary }]}>{t('paywall.unlockBody')}</Text>
                  <View style={[styles.paywallBtn, { backgroundColor: c.primary }]}>
                    <Text style={styles.enableBtnText}>{t('paywall.viewPlans')}</Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontSize: 18, fontWeight: '700' },
  scroll: { padding: 20, paddingTop: 4 },
  consentCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  consentTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  consentBody: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
  enableBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  enableBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  domainRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  domainPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  periodRow: { marginBottom: 8 },
  periodPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  customPeriodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  insightCard: { borderRadius: 16, borderWidth: 1, padding: 20 },
  confidenceBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  confidenceText: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  insightTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  insightBody: { fontSize: 14, lineHeight: 21 },
  evidenceText: { fontSize: 12, marginTop: 14 },
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  teaserCard: { borderRadius: 16, borderWidth: 1, padding: 20, alignItems: 'center', marginBottom: 16 },
  teaserText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  paywallCard: { borderRadius: 16, borderWidth: 1.5, padding: 24, alignItems: 'center' },
  paywallTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  paywallBody: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 16 },
  paywallBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
});
