import { View, Text } from 'react-native';

export function SyncBadge({ synced, label }: { synced?: boolean; label?: string }) {
  return (
    <View className="flex-row items-center gap-1 bg-success/10 border border-success/25 rounded-full px-2.5 py-1">
      <View className={`w-1.5 h-1.5 rounded-full ${synced ? 'bg-success' : 'bg-gold'}`} />
      <Text className="text-success text-[11px]">{label ?? 'Sync'}</Text>
    </View>
  );
}
