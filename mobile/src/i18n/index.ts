import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from '@/locales/en.json';
import pt from '@/locales/pt.json';

const LANG_KEY = '@love-tracker/language';
const supportedLanguages = ['en', 'pt'];

const deviceLocale = Localization.getLocales()[0]?.languageCode ?? 'en';
const initialLocale = supportedLanguages.includes(deviceLocale) ? deviceLocale : 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    pt: { translation: pt },
  },
  lng: initialLocale,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

// Load saved language preference and update if different from device locale
if (typeof window !== 'undefined') {
  AsyncStorage.getItem(LANG_KEY).then((saved) => {
    if (saved && supportedLanguages.includes(saved) && saved !== i18n.language) {
      i18n.changeLanguage(saved);
    }
  });
}

export function setLanguage(lang: string) {
  AsyncStorage.setItem(LANG_KEY, lang);
  i18n.changeLanguage(lang);
}

export default i18n;
