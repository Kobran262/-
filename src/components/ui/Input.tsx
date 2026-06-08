import { TextInput, View, Text, type TextInputProps } from 'react-native';
import { cn } from '@/src/utils/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  className?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <View className="mb-3">
      {label ? <Text className="text-foreground/70 text-sm mb-1">{label}</Text> : null}
      <TextInput
        className={cn(
          'bg-card border border-white/10 rounded-xl px-4 py-3 text-foreground text-base',
          error && 'border-danger',
          className
        )}
        placeholderTextColor="#666"
        {...props}
      />
      {error ? <Text className="text-danger text-xs mt-1">{error}</Text> : null}
    </View>
  );
}
