import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { WAREHOUSES } from '@/src/types';

export default function InventoryScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4 pt-4">
        <Text className="text-foreground text-2xl font-bold mb-2">Инвентаризация</Text>
        <Text className="text-foreground/60 mb-6">
          Полный режим инвентаризации с сканированием — в следующей итерации. Сейчас доступен просмотр складов.
        </Text>

        {(Object.entries(WAREHOUSES) as [keyof typeof WAREHOUSES, string][]).map(([id, name]) => (
          <Card key={id} className="mb-3">
            <Text className="text-gold font-mono">{id}</Text>
            <Text className="text-foreground">{name}</Text>
          </Card>
        ))}

        <Button title="Создать инвентаризацию (скоро)" variant="secondary" disabled className="mt-4 mb-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
