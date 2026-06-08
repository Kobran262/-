import { View, Text } from 'react-native';
import { getInitials } from '@/src/utils/actDisplay';

export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  return (
    <View
      className="rounded-full bg-gold/10 border border-gold/30 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Text className="text-gold text-xs font-medium">{getInitials(name)}</Text>
    </View>
  );
}
