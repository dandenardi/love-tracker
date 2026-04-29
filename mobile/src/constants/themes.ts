export type ThemeKey = 'romantic' | 'darkEmber' | 'ocean' | 'forest' | 'midnight' | 'minimal';

export interface ThemeColors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  accent: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  success: string;
  warning: string;
  error: string;
  tabBar: string;
  tabBarActive: string;
  tabBarInactive: string;
}

export interface Theme {
  key: ThemeKey;
  name: string;
  emoji: string;
  colors: ThemeColors;
}

const base = {
  success: '#4ADE80',
  warning: '#FCD34D',
  error:   '#F87171',
};

export const THEMES: Record<ThemeKey, Theme> = {
  romantic: {
    key: 'romantic', name: 'Romantic', emoji: '🌹',
    colors: {
      ...base,
      primary:        '#E85D75',
      primaryLight:   '#F4839A',
      primaryDark:    '#C23A56',
      accent:         '#FF6B9D',
      background:     '#110A0D',
      surface:        '#1E1117',
      surfaceAlt:     '#2D1820',
      border:         '#3D2230',
      text:           '#F8ECF0',
      textSecondary:  '#C9A0B0',
      textMuted:      '#7A5060',
      tabBar:         '#1A0F14',
      tabBarActive:   '#E85D75',
      tabBarInactive: '#7A5060',
    },
  },
  darkEmber: {
    key: 'darkEmber', name: 'Dark Ember', emoji: '🔥',
    colors: {
      ...base,
      primary:        '#F4A261',
      primaryLight:   '#F7BA8A',
      primaryDark:    '#D4733A',
      accent:         '#E76F51',
      background:     '#0E0C0A',
      surface:        '#1C1917',
      surfaceAlt:     '#2A2520',
      border:         '#3D352C',
      text:           '#F5F0EA',
      textSecondary:  '#B8A898',
      textMuted:      '#6B5D50',
      tabBar:         '#161310',
      tabBarActive:   '#F4A261',
      tabBarInactive: '#6B5D50',
    },
  },
  ocean: {
    key: 'ocean', name: 'Ocean', emoji: '🌊',
    colors: {
      ...base,
      primary:        '#4ECDC4',
      primaryLight:   '#7EDDD6',
      primaryDark:    '#2BA39B',
      accent:         '#45B7D1',
      background:     '#060E14',
      surface:        '#0D1B2A',
      surfaceAlt:     '#132233',
      border:         '#1C3045',
      text:           '#E8F4F8',
      textSecondary:  '#8DB4C8',
      textMuted:      '#446070',
      tabBar:         '#091520',
      tabBarActive:   '#4ECDC4',
      tabBarInactive: '#446070',
    },
  },
  forest: {
    key: 'forest', name: 'Forest', emoji: '🌿',
    colors: {
      ...base,
      primary:        '#74B49B',
      primaryLight:   '#96CAB3',
      primaryDark:    '#4D927A',
      accent:         '#A7C957',
      background:     '#080E0A',
      surface:        '#0F1A11',
      surfaceAlt:     '#172619',
      border:         '#213326',
      text:           '#E8F2EC',
      textSecondary:  '#90B898',
      textMuted:      '#4A6652',
      tabBar:         '#0C150E',
      tabBarActive:   '#74B49B',
      tabBarInactive: '#4A6652',
    },
  },
  midnight: {
    key: 'midnight', name: 'Midnight', emoji: '🌙',
    colors: {
      ...base,
      primary:        '#A855F7',
      primaryLight:   '#C084FC',
      primaryDark:    '#7C3AED',
      accent:         '#818CF8',
      background:     '#07050F',
      surface:        '#0F0B1A',
      surfaceAlt:     '#1A1428',
      border:         '#2D2545',
      text:           '#EDE9FE',
      textSecondary:  '#A898D0',
      textMuted:      '#5A4E7A',
      tabBar:         '#0B0816',
      tabBarActive:   '#A855F7',
      tabBarInactive: '#5A4E7A',
    },
  },
  minimal: {
    key: 'minimal', name: 'Minimal', emoji: '⬛',
    colors: {
      ...base,
      primary:        '#64748B',
      primaryLight:   '#94A3B8',
      primaryDark:    '#475569',
      accent:         '#0EA5E9',
      background:     '#080808',
      surface:        '#111111',
      surfaceAlt:     '#1A1A1A',
      border:         '#2A2A2A',
      text:           '#F0F0F0',
      textSecondary:  '#A0A0A0',
      textMuted:      '#555555',
      tabBar:         '#0D0D0D',
      tabBarActive:   '#F0F0F0',
      tabBarInactive: '#555555',
    },
  },
};

export const DEFAULT_THEME: ThemeKey = 'romantic';
