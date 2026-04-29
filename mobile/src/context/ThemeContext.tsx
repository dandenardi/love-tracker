import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_THEME, THEMES, type Theme, type ThemeKey } from '@/constants/themes';

const THEME_KEY = '@love-tracker/selectedTheme';

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
  const [themeKey, setThemeKey] = useState<ThemeKey>(DEFAULT_THEME);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved && THEMES[saved as ThemeKey]) {
        setThemeKey(saved as ThemeKey);
      }
    });
  }, []);

  const setTheme = (key: ThemeKey) => {
    AsyncStorage.setItem(THEME_KEY, key);
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
