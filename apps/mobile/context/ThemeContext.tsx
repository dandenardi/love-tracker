import React, { createContext, useContext, useEffect, useState } from 'react';
import { createMMKV, type MMKV } from 'react-native-mmkv';
import { DEFAULT_THEME, THEMES, type Theme, type ThemeKey } from '@/constants/themes';

let storage: MMKV;
try {
  storage = createMMKV({ id: 'love-tracker-prefs' });
} catch (e) {
  storage = { 
    set: () => {}, 
    getString: () => null, 
    getNumber: () => 0, 
    getBoolean: () => false,
    delete: () => {} 
  } as any;
}
const THEME_KEY = 'selectedTheme';

interface ThemeContextValue {
  theme: Theme;
  themeKey: ThemeKey;
  setTheme: (key: ThemeKey) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: THEMES[DEFAULT_THEME],
  themeKey: DEFAULT_THEME,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeKey, setThemeKey] = useState<ThemeKey>(() => {
    const saved = storage.getString(THEME_KEY) as ThemeKey | undefined;
    return saved && THEMES[saved] ? saved : DEFAULT_THEME;
  });

  const setTheme = (key: ThemeKey) => {
    storage.set(THEME_KEY, key);
    setThemeKey(key);
  };

  return (
    <ThemeContext.Provider value={{ theme: THEMES[themeKey], themeKey, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
