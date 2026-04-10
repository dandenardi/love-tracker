import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { Text } from 'react-native';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 24 : 20, opacity: focused ? 1 : 0.5 }}>
      {emoji}
    </Text>
  );
}

export default function TabLayout() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: c.tabBar,
          borderTopColor: c.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: c.tabBarActive,
        tabBarInactiveTintColor: c.tabBarInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: t('tabs.calendar'),
          tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          title: t('tabs.timeline'),
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t('tabs.stats'),
          tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
