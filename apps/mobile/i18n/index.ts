import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { createMMKV } from 'react-native-mmkv';

import en from '@/locales/en.json';
import pt from '@/locales/pt.json';

const storage = createMMKV({ id: 'love-tracker-prefs' });
const LANG_KEY = 'language';

const deviceLocale = Localization.getLocales()[0]?.languageCode ?? 'en';
const savedLocale = storage.getString(LANG_KEY);

const supportedLanguages = ['en', 'pt'];
const resolvedLocale =
  savedLocale && supportedLanguages.includes(savedLocale)
    ? savedLocale
    : supportedLanguages.includes(deviceLocale)
    ? deviceLocale
    : 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    pt: { translation: pt },
  },
  lng: resolvedLocale,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export function setLanguage(lang: string) {
  storage.set(LANG_KEY, lang);
  i18n.changeLanguage(lang);
}

export default i18n;
