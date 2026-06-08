import { View, Text } from 'react-native';

const STEPS = ['Тип', 'Шапка', 'Позиции', 'Итог'];

export function StepIndicator({ current }: { current: number }) {
  return (
    <View className="flex-row items-start px-1 mb-4">
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const done = stepNum < current;
        const active = stepNum === current;
        return (
          <View key={label} className="flex-1 flex-row items-center">
            <View className="items-center flex-1">
              <View
                className={`w-7 h-7 rounded-full items-center justify-center ${
                  done
                    ? 'bg-gold'
                    : active
                      ? 'bg-gold/10 border-[1.5px] border-gold'
                      : 'bg-surface border border-border'
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    done ? 'text-background' : active ? 'text-gold' : 'text-[#555]'
                  }`}
                >
                  {done ? '✓' : stepNum}
                </Text>
              </View>
              <Text className="text-[10px] text-[#555] mt-1">{label}</Text>
            </View>
            {i < STEPS.length - 1 && (
              <View
                className={`h-px flex-1 mb-4 ${stepNum < current ? 'bg-gold/30' : 'bg-border'}`}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}
