import { View, Text, Pressable, ActivityIndicator, type PressableProps } from 'react-native';
import { cn } from '@/src/utils/theme';

interface ButtonProps extends PressableProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  className?: string;
}

const variants = {
  primary: 'bg-gold active:opacity-80',
  secondary: 'bg-card border border-gold/30 active:opacity-80',
  danger: 'bg-danger active:opacity-80',
  ghost: 'bg-transparent active:opacity-60',
};

const textVariants = {
  primary: 'text-background font-semibold',
  secondary: 'text-foreground',
  danger: 'text-white font-semibold',
  ghost: 'text-gold',
};

export function Button({
  title,
  variant = 'primary',
  loading,
  disabled,
  className,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      className={cn(
        'rounded-xl px-4 py-3 items-center justify-center min-h-[48px]',
        variants[variant],
        (disabled || loading) && 'opacity-50',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#0F0F0F' : '#C8A96E'} />
      ) : (
        <Text className={cn('text-base', textVariants[variant])}>{title}</Text>
      )}
    </Pressable>
  );
}
