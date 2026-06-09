import { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import Svg, { Path } from 'react-native-svg';
import { calcAccountingStock, getProducts } from '@/src/db/queries';
import { exportStockCsv, shareCsv } from '@/src/services/csv/exporter';
import { WAREHOUSES } from '@/src/types';

type StockRow = Awaited<ReturnType<typeof calcAccountingStock>>[number] & { category: string };

type ListItem =
  | { kind: 'warehouse'; warehouse: string; id: string }
  | { kind: 'category'; category: string; id: string }
  | { kind: 'row'; row: StockRow; id: string };

export default function StockScreen() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [stock, products] = await Promise.all([calcAccountingStock(), getProducts()]);
    const categoryBySku = new Map(products.map((p) => [p.id, p.category]));
    setRows(
      stock.map((s) => ({
        ...s,
        category: categoryBySku.get(s.sku) ?? 'Прочее',
      }))
    );
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

  const handleExport = async () => {
    try {
      const path = await exportStockCsv();
      await shareCsv(path);
    } catch (e) {
      Alert.alert('Ошибка экспорта', e instanceof Error ? e.message : String(e));
    }
  };

  const flatData = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rows.filter(
      (r) =>
        !q ||
        r.sku.toLowerCase().includes(q) ||
        r.product_name.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
    );

    const sorted = [...filtered].sort(
      (a, b) =>
        a.warehouse.localeCompare(b.warehouse) ||
        a.category.localeCompare(b.category) ||
        a.sku.localeCompare(b.sku)
    );

    const items: ListItem[] = [];
    let lastWh = '';
    let lastCat = '';

    for (const row of sorted) {
      if (row.qty === 0 && !q) continue;
      if (row.warehouse !== lastWh) {
        items.push({ kind: 'warehouse', warehouse: row.warehouse, id: `wh-${row.warehouse}` });
        lastWh = row.warehouse;
        lastCat = '';
      }
      if (row.category !== lastCat) {
        items.push({
          kind: 'category',
          category: row.category,
          id: `cat-${row.warehouse}-${row.category}`,
        });
        lastCat = row.category;
      }
      items.push({ kind: 'row', row, id: `${row.sku}-${row.warehouse}` });
    }

    return items;
  }, [rows, search]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-5 pt-2 pb-3 flex-row items-center justify-between">
        <Text className="text-foreground text-lg font-medium">Остатки</Text>
        <Pressable
          onPress={handleExport}
          className="flex-row items-center gap-1.5 bg-surface border border-border rounded-lg px-3 py-2"
        >
          <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 3v12M7 8l5 5 5-5M5 21h14"
              stroke="#C8A96E"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text className="text-gold text-xs">CSV</Text>
        </Pressable>
      </View>

      <View className="px-5 pb-3">
        <TextInput
          className="bg-surface border border-border rounded-xl px-3.5 py-2.5 text-foreground text-sm"
          placeholder="Поиск по SKU или названию…"
          placeholderTextColor="#555"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlashList
        data={flatData}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C8A96E" />
        }
        ListEmptyComponent={
          <View className="px-5 py-8">
            <Text className="text-[#555] text-center text-sm">Нет данных об остатках</Text>
          </View>
        }
        renderItem={({ item }) => {
          if (item.kind === 'warehouse') {
            const label =
              WAREHOUSES[item.warehouse as keyof typeof WAREHOUSES] ?? item.warehouse;
            return (
              <View className="px-5 pt-4 pb-1">
                <Text className="text-gold text-xs uppercase tracking-widest">{label}</Text>
              </View>
            );
          }
          if (item.kind === 'category') {
            return (
              <View className="px-5 pt-2 pb-1">
                <Text className="text-[#666] text-[11px] uppercase tracking-wide">
                  {item.category}
                </Text>
              </View>
            );
          }
          const { row } = item;
          return (
            <View className="mx-5 mb-2 bg-surface border border-border rounded-xl px-3.5 py-3 flex-row items-center">
              <View className="flex-1">
                <Text className="text-foreground text-sm font-medium">{row.product_name}</Text>
                <Text className="text-[#555] text-[11px] mt-0.5">{row.sku}</Text>
              </View>
              <View className="items-end">
                <Text
                  className={`text-base font-medium ${row.qty < 0 ? 'text-danger' : 'text-foreground'}`}
                >
                  {row.qty % 1 === 0 ? row.qty : row.qty.toFixed(2)}
                </Text>
                <Text className="text-[#555] text-[10px]">{row.unit}</Text>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
