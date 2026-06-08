import { Text, View } from 'react-native';
import type { ActStatus } from '@/src/types';
import { STATUS_STYLES } from '@/src/utils/actDisplay';

export function StatusBadge({ status }: { status: ActStatus }) {
  const config = STATUS_STYLES[status];
  return (
    <View className={`px-2 py-0.5 rounded-full ${config.container}`}>
      <Text className={`text-[10px] font-medium ${config.text}`}>{config.label}</Text>
    </View>
  );
}
