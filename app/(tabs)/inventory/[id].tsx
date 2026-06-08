import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  getInventoryActById,
  getInventoryLines,
  updateInventoryLine,
  closeInventoryAct,
} from '@/src/db/queries';
import { WAREHOUSES, type WarehouseId } from '@/src/types';

const WAREHOUSE_ORDER: WarehouseId[] = ['WH-01', 'WH-02', 'WH-03', 'WH-04'];

export default function InventoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [act, setAct] = useState<Awaited<ReturnType<typeof getInventoryActById>> | null>(null);
  const [lines, setLines] = useState<Awaited<ReturnType<typeof getInventoryLines>>>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    'WH-01': true,
    'WH-02': true,
    'WH-03': true,
    'WH-04': true,
  });
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setAct(await getInventoryActById(id));
    setLines(await getInventoryLines(id));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleQtyChange = async (lineId: string, val: string, accounting: number) => {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    await updateInventoryLine(lineId, num);
    await load();
  };

  const handleReasonChange = async (lineId: string, reason: string) => {
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;
    await updateInventoryLine(lineId, line.qty_actual ?? 0, reason);
    await load();
  };

  const handleClose = () => {
    Alert.alert('Закрыть ведомость?', 'После закрытия редактирование будет невозможно', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Закрыть',
        onPress: async () => {
          if (!id) return;
          setLoading(true);
          await closeInventoryAct(id);
          await load();
          setLoading(false);
        },
      },
    ]);
  };

  if (!act) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Text className="text-[#555]">Загрузка...</Text>
      </SafeAreaView>
    );
  }

  const isDraft = act.status === 'draft';
  const filteredLines = onlyDiff
    ? lines.filter((l) => Math.abs(l.diff_pct ?? 0) > 5 || (l.qty_diff ?? 0) !== 0)
    : lines;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="px-5 pt-2 pb-3 flex-row items-center gap-3">
        <Pressable
          onPress={() => router.back()}
          className="w-[34px] h-[34px] rounded-[10px] bg-surface border border-border items-center justify-center"
        >
          <Text className="text-[#888] text-lg">‹</Text>
        </Pressable>
        <View className="flex-1">
          <Text className="text-[17px] text-foreground font-medium">{act.number}</Text>
          <Text className="text-[11px] text-[#555]">
            {act.status === 'closed' ? 'Закрыта' : 'Черновик'} · {lines.length} поз.
          </Text>
        </View>
      </View>

      <View className="px-5 pb-2 flex-row items-center justify-between">
        <Text className="text-[11px] text-[#555]">Показать только с отклонением</Text>
        <Switch
          value={onlyDiff}
          onValueChange={setOnlyDiff}
          trackColor={{ false: '#333', true: '#C8A96E' }}
          thumbColor="#fff"
        />
      </View>

      <ScrollView className="flex-1 px-5">
        {WAREHOUSE_ORDER.map((wh) => {
          const whLines = filteredLines.filter((l) => l.warehouse === wh);
          if (whLines.length === 0) return null;

          return (
            <View key={wh} className="mb-3">
              <Pressable
                onPress={() => setExpanded((e) => ({ ...e, [wh]: !e[wh] }))}
                className="flex-row items-center justify-between bg-surface border border-border rounded-t-xl px-4 py-3"
              >
                <View>
                  <Text className="text-gold font-mono text-sm">{wh}</Text>
                  <Text className="text-[#555] text-xs">{WAREHOUSES[wh]}</Text>
                </View>
                <Text className="text-[#888]">{expanded[wh] ? '▾' : '▸'} {whLines.length}</Text>
              </Pressable>

              {expanded[wh] &&
                whLines.map((line) => {
                  const showReason = Math.abs(line.diff_pct ?? 0) > 5;
                  const hasDiff = (line.qty_diff ?? 0) !== 0;

                  return (
                    <View
                      key={line.id}
                      className={`bg-surface border-x border-b border-border px-4 py-3 ${
                        hasDiff ? 'border-l-2 border-l-danger' : ''
                      }`}
                    >
                      <Text className="text-gold text-[9px]">{line.sku}</Text>
                      <Text className="text-foreground text-sm mb-2">{line.product_name}</Text>

                      <View className="flex-row justify-between mb-1">
                        <Text className="text-[#555] text-xs">Учётный остаток</Text>
                        <Text className="text-foreground text-xs">
                          {line.qty_accounting ?? 0} {line.unit}
                        </Text>
                      </View>

                      {isDraft ? (
                        <View className="flex-row items-center justify-between mb-1">
                          <Text className="text-[#555] text-xs">Факт</Text>
                          <TextInput
                            className="text-foreground text-sm bg-background border border-border rounded px-2 py-1 min-w-[80px] text-right"
                            value={String(line.qty_actual ?? '')}
                            keyboardType="numeric"
                            onChangeText={(val) =>
                              handleQtyChange(line.id, val, line.qty_accounting ?? 0)
                            }
                          />
                        </View>
                      ) : (
                        <View className="flex-row justify-between mb-1">
                          <Text className="text-[#555] text-xs">Факт</Text>
                          <Text className="text-foreground text-xs">
                            {line.qty_actual ?? 0} {line.unit}
                          </Text>
                        </View>
                      )}

                      <View className="flex-row justify-between">
                        <Text className="text-[#555] text-xs">Отклонение</Text>
                        <Text
                          className={`text-xs ${
                            hasDiff ? 'text-danger' : 'text-success'
                          }`}
                        >
                          {line.qty_diff != null && line.qty_diff > 0 ? '+' : ''}
                          {line.qty_diff ?? 0} ({(line.diff_pct ?? 0).toFixed(1)}%)
                        </Text>
                      </View>

                      {showReason && isDraft && (
                        <View className="mt-2">
                          <Text className="text-[10px] text-danger mb-1">Причина отклонения (&gt;5%)</Text>
                          <TextInput
                            className="text-foreground text-sm bg-background border border-danger/30 rounded px-2 py-1"
                            value={line.reason ?? ''}
                            placeholder="Укажите причину"
                            placeholderTextColor="#444"
                            onChangeText={(val) => handleReasonChange(line.id, val)}
                          />
                        </View>
                      )}
                    </View>
                  );
                })}
            </View>
          );
        })}
        <View className="h-24" />
      </ScrollView>

      {isDraft && (
        <View className="px-5 py-3 bg-background border-t border-[#1f1f1f]">
          <Pressable
            onPress={handleClose}
            disabled={loading}
            className="bg-gold rounded-xl py-3.5 items-center"
          >
            <Text className="text-background font-medium">
              {loading ? 'Закрытие…' : 'Закрыть ведомость'}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
