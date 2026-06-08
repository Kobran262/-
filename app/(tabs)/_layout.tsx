import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

function TabIcon({ name, color }: { name: React.ComponentProps<typeof FontAwesome>['name']; color: string }) {
  return <FontAwesome size={22} name={name} color={color} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#C8A96E',
        tabBarInactiveTintColor: '#555555',
        tabBarStyle: {
          backgroundColor: '#0F0F0F',
          borderTopColor: '#1f1f1f',
          borderTopWidth: 0.5,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Главная',
          tabBarIcon: ({ color }) => <TabIcon name="home" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="acts/index"
        options={{
          title: 'Акты',
          tabBarIcon: ({ color }) => <TabIcon name="file-text-o" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="products/index"
        options={{
          title: 'Товары',
          tabBarIcon: ({ color }) => <TabIcon name="cube" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Сканер',
          tabBarIcon: ({ color }) => <TabIcon name="barcode" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Инвент.',
          tabBarIcon: ({ color }) => <TabIcon name="list-alt" color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Профиль',
          tabBarIcon: ({ color }) => <TabIcon name="user-o" color={String(color)} />,
        }}
      />
      <Tabs.Screen name="acts/new" options={{ href: null }} />
      <Tabs.Screen name="acts/[id]" options={{ href: null }} />
      <Tabs.Screen name="products/[id]" options={{ href: null }} />
      <Tabs.Screen name="products/barcodes" options={{ href: null }} />
      <Tabs.Screen name="inventory/[id]" options={{ href: null }} />
    </Tabs>
  );
}
