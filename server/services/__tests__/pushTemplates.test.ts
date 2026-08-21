import { normalizeLocale, pokeSentBody, pokeDeliveredBody, eventLoggedBody } from '../pushTemplates';

describe('normalizeLocale', () => {
  it('returns "pt" only for the exact string "pt"', () => {
    expect(normalizeLocale('pt')).toBe('pt');
  });

  it('defaults to "en" for anything else, including null/undefined/unknown values', () => {
    expect(normalizeLocale('en')).toBe('en');
    expect(normalizeLocale(null)).toBe('en');
    expect(normalizeLocale(undefined)).toBe('en');
    expect(normalizeLocale('es')).toBe('en');
    expect(normalizeLocale('')).toBe('en');
  });
});

describe('pokeSentBody', () => {
  it('renders in English', () => {
    expect(pokeSentBody('en', 'Ana', '💌')).toBe('💌 Ana sent you a poke!');
  });

  it('renders in Portuguese', () => {
    expect(pokeSentBody('pt', 'Ana', '💌')).toBe('💌 Ana te enviou um toque!');
  });
});

describe('pokeDeliveredBody', () => {
  it('renders in English', () => {
    expect(pokeDeliveredBody('en', 'Ana')).toBe('Ana just received your poke! Want to reply?');
  });

  it('renders in Portuguese', () => {
    expect(pokeDeliveredBody('pt', 'Ana')).toBe('Ana recebeu seu toque! Quer responder?');
  });
});

describe('eventLoggedBody', () => {
  it('renders a new event in English and Portuguese', () => {
    expect(eventLoggedBody('en', false, 'AFFECTION', 'Ana')).toBe('Ana logged Affection ❤️');
    expect(eventLoggedBody('pt', false, 'AFFECTION', 'Ana')).toBe('Ana registrou Afeto ❤️');
  });

  it('renders an updated event in English and Portuguese', () => {
    expect(eventLoggedBody('en', true, 'DATE', 'Ana')).toBe('Ana updated Date 🌙');
    expect(eventLoggedBody('pt', true, 'DATE', 'Ana')).toBe('Ana atualizou Encontro 🌙');
  });

  it('falls back to the raw type key with a generic emoji for an unknown/untranslated type', () => {
    expect(eventLoggedBody('en', false, 'POKE', 'Ana')).toBe('Ana logged POKE 📝');
    expect(eventLoggedBody('pt', false, 'POKE', 'Ana')).toBe('Ana registrou POKE 📝');
  });
});
