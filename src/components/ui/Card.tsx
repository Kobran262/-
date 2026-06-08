import { View, type ViewProps } from 'react-native';
import { cn } from '@/src/utils/theme';

export function Card({ className, children, ...props }: ViewProps & { className?: string }) {
  return (
    <View className={cn('bg-card rounded-2xl p-4 border border-white/5', className)} {...props}>
      {children}
    </View>
  );
}
