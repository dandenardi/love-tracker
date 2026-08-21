export type Locale = 'en' | 'pt';

export function normalizeLocale(raw: string | null | undefined): Locale {
  return raw === 'pt' ? 'pt' : 'en';
}

const EVENT_TYPE_LABELS: Record<Locale, Record<string, { label: string; emoji: string }>> = {
  en: {
    INTIMACY: { label: 'Intimacy', emoji: '🔥' },
    FIGHT: { label: 'Fight', emoji: '⚡' },
    AFFECTION: { label: 'Affection', emoji: '❤️' },
    DATE: { label: 'Date', emoji: '🌙' },
    SPECIAL: { label: 'Special', emoji: '⭐' },
    MILESTONE: { label: 'Milestone', emoji: '💋' },
    CUSTOM: { label: 'Custom', emoji: '✏️' },
  },
  pt: {
    INTIMACY: { label: 'Intimidade', emoji: '🔥' },
    FIGHT: { label: 'Briga', emoji: '⚡' },
    AFFECTION: { label: 'Afeto', emoji: '❤️' },
    DATE: { label: 'Encontro', emoji: '🌙' },
    SPECIAL: { label: 'Especial', emoji: '⭐' },
    MILESTONE: { label: 'Marco', emoji: '💋' },
    CUSTOM: { label: 'Personalizado', emoji: '✏️' },
  },
};

export function pokeSentBody(locale: Locale, senderAlias: string, emoji: string): string {
  return locale === 'pt'
    ? `${emoji} ${senderAlias} te enviou um toque!`
    : `${emoji} ${senderAlias} sent you a poke!`;
}

export function pokeDeliveredBody(locale: Locale, recipientAlias: string): string {
  return locale === 'pt'
    ? `${recipientAlias} recebeu seu toque! Quer responder?`
    : `${recipientAlias} just received your poke! Want to reply?`;
}

export function eventLoggedBody(locale: Locale, isUpdate: boolean, eventType: string, senderAlias: string): string {
  const typeInfo = EVENT_TYPE_LABELS[locale][eventType] || { label: eventType, emoji: '📝' };
  return locale === 'pt'
    ? `${senderAlias} ${isUpdate ? 'atualizou' : 'registrou'} ${typeInfo.label} ${typeInfo.emoji}`
    : `${senderAlias} ${isUpdate ? 'updated' : 'logged'} ${typeInfo.label} ${typeInfo.emoji}`;
}
