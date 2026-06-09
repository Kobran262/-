import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { getInventoryActs, createInventoryAct } from '@/src/db/queries';
import { sql, inArray } from 'drizzle-orm';
import { getDb } from '@/src/db/client';
import { inventory_lines } from '@/src/db/schema';

const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

type InventoryAct = Awaited<ReturnType<typeof getInventoryActs>>[number];

export default function InventoryScreen() {
  const router = useRouter();
  const [acts, setActs] = useState<(InventoryAct & { lineCount: number })[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [commission, setCommission] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const list = await getInventoryActs();
    if (list.length === 0) {
      setActs([]);
      return;
    }

    const db = getDb();
    const ids = list.map((a) => a.id);
    const counts = await db
      .select({
        inventory_id: inventory_lines.inventory_id,
        count: sql<number>`count(*)`,
      })
      .from(inventory_lines)
      .where(inArray(inventory_lines.inventory_id, ids))
      .groupBy(inventory_lines.inventory_id);

    const countMap = new Map(counts.map((c) => [c.inventory_id, c.count]));
    setActs(list.map((act) => ({ ...act, lineCount: countMap.get(act.id) ?? 0 })));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleCreate = async () => {
    if (!commission.trim()) {
      Alert.alert('Ошибка', 'Укажите состав комиссии');
      return;
    }
    setCreating(true);
    try {
      const { id } = await createInventoryAct({
        period_month: month,
        period_year: year,
        commission: commission.trim(),
      });
      setModalVisible(false);
      setCommission('');
      router.push(`/(tabs)/inventory/${id}`);
    } catch (e) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось создать инвентаризацию');
    } finally {
      setCreating(false);
    }
  };

  const statusLabel = (status: string) => (status === 'closed' ? 'Закрыта' : 'Черновик');

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-4 pt-4 pb-2 flex-row justify-between items-center">
        <Text className="text-foreground text-2xl font-bold">Инвентаризация</Text>
        <Pressable
          onPress={() => setModalVisible(true)}
          className="bg-gold rounded-lg px-3 py-2"
        >
          <Text className="text-background text-sm font-medium">+ Новая</Text>
        </Pressable>
      </View>

      <FlatList
        data={acts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C8A96E" />}
        contentContainerClassName="px-4 pb-8"
        ListEmptyComponent={
          <Text className="text-[#555] text-center mt-8">Нет инвентаризаций. Создайте первую.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(tabs)/inventory/${item.id}`)}
            className="bg-surface rounded-xl border border-border p-4 mb-3"
          >
            <View className="flex-row justify-between items-start mb-1">
              <Text className="text-gold font-mono text-sm">{item.number}</Text>
              <Text
                className={`text-xs px-2 py-0.5 rounded ${
                  item.status === 'closed' ? 'text-success bg-success/10' : 'text-[#888] bg-[#222]'
                }`}
              >
                {statusLabel(item.status)}
              </Text>
            </View>
            <Text className="text-foreground text-base">
              {MONTHS[item.period_month - 1]} {item.period_year}
            </Text>
            <Text className="text-[#555] text-sm mt-1">Позиций: {item.lineCount}</Text>
          </Pressable>
        )}
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-background rounded-t-2xl p-5">
            <Text className="text-foreground text-lg font-bold mb-4">Новая инвентаризация</Text>

            <Text className="text-[11px] text-[#555] uppercase tracking-widest mb-2">Месяц</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {MONTHS.map((name, idx) => (
                <Pressable
                  key={name}
                  onPress={() => setMonth(idx + 1)}
                  className={`px-3 py-1.5 rounded-lg border ${
                    month === idx + 1 ? 'border-gold bg-gold/10' : 'border-border'
                  }`}
                >
                  <Text className={month === idx + 1 ? 'text-gold text-xs' : 'text-[#888] text-xs'}>
                    {name.slice(0, 3)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text className="text-[11px] text-[#555] uppercase tracking-widest mb-2">Год</Text>
            <View className="flex-row gap-2 mb-4">
              {[year - 1, year, year + 1].map((y) => (
                <Pressable
                  key={y}
                  onPress={() => setYear(y)}
                  className={`px-4 py-2 rounded-lg border ${
                    year === y ? 'border-gold bg-gold/10' : 'border-border'
                  }`}
                >
                  <Text className={year === y ? 'text-gold' : 'text-[#888]'}>{y}</Text>
                </Pressable>
              ))}
            </View>

            <View className="bg-surface rounded-[10px] border border-border px-3.5 py-2.5 mb-4">
              <Text className="text-[10px] text-[#555] uppercase tracking-wide mb-1">
                Состав комиссии
              </Text>
              <TextInput
                className="text-sm text-foreground p-0"
                value={commission}
                onChangeText={setCommission}
                placeholder="Иван И., Наталья К."
                placeholderTextColor="#444"
              />
            </View>

            <View className="flex-row gap-2">
              <Pressable
                onPress={() => setModalVisible(false)}
                className="flex-1 bg-surface border border-border rounded-xl py-3.5 items-center"
              >
                <Text className="text-[#888]">Отмена</Text>
              </Pressable>
              <Pressable
                onPress={handleCreate}
                disabled={creating}
                className="flex-[2] bg-gold rounded-xl py-3.5 items-center"
              >
                <Text className="text-background font-medium">
                  {creating ? 'Создание…' : 'Создать'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
