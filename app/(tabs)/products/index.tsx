import { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { getProductsCatalog, toggleProductActive, bindBarcode, updateProduct } from '@/src/db/queries';
import { generateBarcodePng, generateEan13 } from '@/src/services/barcode/generator';
import { ALL_CATEGORIES, ALL_CHANNELS } from '@/src/utils/productContext';
import { WAREHOUSES, type WarehouseId } from '@/src/types';

type ProductRow = Awaited<ReturnType<typeof getProductsCatalog>>[number];
type TabFilter = 'all' | 'tea' | 'equipment' | 'materials';

type ListItem =
  | { kind: 'header'; category: string; id: string }
  | { kind: 'product'; product: ProductRow; id: string };

export default function ProductsCatalogScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [warehouseFilter, setWarehouseFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await getProductsCatalog({
      search: search || undefined,
      category: categoryFilter ?? undefined,
      channel: channelFilter ?? undefined,
      warehouse: warehouseFilter ?? undefined,
      onlyMaterials: tab === 'materials' ? true : undefined,
      onlyTea: tab === 'tea' ? true : undefined,
      onlyEquipment: tab === 'equipment' ? true : undefined,
      includeInactive: true,
    });
    setProducts(data);
  }, [search, tab, channelFilter, categoryFilter, warehouseFilter]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const flatData = useMemo(() => {
    const items: ListItem[] = [];
    let lastCat = '';
    for (const p of products) {
      if (p.category !== lastCat) {
        items.push({ kind: 'header', category: p.category, id: `h-${p.category}` });
        lastCat = p.category;
      }
      items.push({ kind: 'product', product: p, id: p.id });
    }
    return items;
  }, [products]);

  const resetFilters = () => {
    setChannelFilter(null);
    setCategoryFilter(null);
    setWarehouseFilter(null);
  };

  const handleToggleActive = async (sku: string) => {
    await toggleProductActive(sku);
    load();
  };

  const tabs: { key: TabFilter; label: string }[] = [
    { key: 'all', label: 'Все' },
    { key: 'tea', label: 'Чай' },
    { key: 'equipment', label: 'Оборудование' },
    { key: 'materials', label: 'Материалы' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-5 pt-2 pb-3 flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="text-[17px] text-foreground font-medium">Товары</Text>
          <Text className="text-[11px] text-[#555]">{products.length} SKU</Text>
        </View>
        <Pressable
          onPress={() => setShowFilters((v) => !v)}
          className="w-[34px] h-[34px] rounded-[10px] bg-surface border border-border items-center justify-center"
        >
          <Text className="text-[#888]">⚙</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(tabs)/products/barcodes')}
          className="bg-surface border border-border rounded-[10px] px-2.5 py-2"
        >
          <Text className="text-gold text-xs">🖨 Штрихкоды</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: '/(tabs)/products/[id]', params: { id: 'new', mode: 'new' } })}
          className="bg-gold rounded-[10px] px-3 py-2"
        >
          <Text className="text-background text-sm font-medium">+ Добавить</Text>
        </Pressable>
      </View>

      <View className="mx-5 mb-3 bg-surface border border-border rounded-xl px-3.5 flex-row items-center gap-2">
        <Text className="text-[#555]">🔍</Text>
        <TextInput
          className="flex-1 text-foreground text-sm py-2.5"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={load}
          placeholder="Поиск по названию или SKU..."
          placeholderTextColor="#444"
          clearButtonMode="while-editing"
        />
      </View>

      <View className="px-5 pb-2 flex-row gap-2">
        {tabs.map(({ key, label }) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            className={`flex-1 py-1.5 rounded-lg border items-center ${
              tab === key ? 'border-gold bg-gold/10' : 'border-border bg-surface'
            }`}
          >
            <Text className={`text-xs ${tab === key ? 'text-gold' : 'text-[#888]'}`}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {showFilters && (
        <View className="px-5 pb-3 gap-2 border-b border-border">
          <View className="flex-row justify-between items-center">
            <Text className="text-[10px] text-[#555] uppercase">Фильтры</Text>
            <Pressable onPress={resetFilters}>
              <Text className="text-gold text-xs">Сбросить</Text>
            </Pressable>
          </View>
          <Text className="text-[10px] text-[#555]">Канал</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {ALL_CHANNELS.map((ch) => (
              <Pressable
                key={ch}
                onPress={() => setChannelFilter(channelFilter === ch ? null : ch)}
                className={`px-2 py-1 rounded-md border ${
                  channelFilter === ch ? 'border-gold bg-gold/10' : 'border-border bg-surface'
                }`}
              >
                <Text className={`text-[10px] ${channelFilter === ch ? 'text-gold' : 'text-[#888]'}`}>
                  {ch}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text className="text-[10px] text-[#555]">Категория</Text>
          <View className="flex-row flex-wrap gap-1.5 max-h-16 overflow-hidden">
            {ALL_CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                className={`px-2 py-1 rounded-md border ${
                  categoryFilter === cat ? 'border-gold bg-gold/10' : 'border-border bg-surface'
                }`}
              >
                <Text className={`text-[10px] ${categoryFilter === cat ? 'text-gold' : 'text-[#888]'}`}>
                  {cat}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text className="text-[10px] text-[#555]">Склад</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {(Object.keys(WAREHOUSES) as WarehouseId[]).map((wh) => (
              <Pressable
                key={wh}
                onPress={() => setWarehouseFilter(warehouseFilter === wh ? null : wh)}
                className={`px-2 py-1 rounded-md border ${
                  warehouseFilter === wh ? 'border-gold bg-gold/10' : 'border-border bg-surface'
                }`}
              >
                <Text className={`text-[10px] ${warehouseFilter === wh ? 'text-gold' : 'text-[#888]'}`}>
                  {wh}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <FlashList
        data={flatData}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        keyExtractor={(item) => item.id}
        onRefresh={load}
        refreshing={false}
        renderItem={({ item }) => {
          if (item.kind === 'header') {
            return (
              <Text className="text-[11px] text-gold uppercase tracking-widest mt-4 mb-2">
                {item.category}
              </Text>
            );
          }

          const p = item.product;
          const inactive = !p.is_active;

          return (
            <Swipeable
              renderLeftActions={() => (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/products/[id]',
                      params: { id: p.id, mode: 'edit' },
                    })
                  }
                  className="bg-blue-600 justify-center px-4 rounded-l-xl mb-2"
                >
                  <Text className="text-white text-xs">Редактировать</Text>
                </Pressable>
              )}
              renderRightActions={() => (
                <Pressable
                  onPress={() =>
                    Alert.alert(
                      p.is_active ? 'Деактивировать?' : 'Активировать?',
                      p.name,
                      [
                        { text: 'Отмена', style: 'cancel' },
                        { text: 'Да', onPress: () => handleToggleActive(p.id) },
                      ]
                    )
                  }
                  className="bg-[#444] justify-center px-4 rounded-r-xl mb-2"
                >
                  <Text className="text-white text-xs">{p.is_active ? 'Деактив.' : 'Актив.'}</Text>
                </Pressable>
              )}
            >
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/products/[id]',
                    params: { id: p.id, mode: 'view' },
                  })
                }
                className={`bg-surface border border-border rounded-xl px-3.5 py-3 mb-2 flex-row ${
                  inactive ? 'opacity-50' : ''
                }`}
              >
                <View className="flex-1">
                  <View className="flex-row items-center gap-1">
                    <Text className="text-gold font-mono text-[9px]">{p.id}</Text>
                    {p.barcode ? <View className="w-1.5 h-1.5 rounded-full bg-gold" /> : null}
                  </View>
                  <Text className="text-foreground text-[13px]">{p.name}</Text>
                  <Text className="text-[#555] text-[11px]">
                    {p.channel} · {p.packaging}
                  </Text>
                  {!p.barcode && (
                    <Pressable
                      onPress={async () => {
                        const code = generateEan13();
                        await bindBarcode(p.id, code);
                        await generateBarcodePng(code, p.id, 'EAN13')
                          .then((path) => updateProduct(p.id, { barcode_image_path: path }))
                          .catch(() => {});
                        load();
                      }}
                      className="mt-1 self-start bg-gold/10 border border-gold/25 rounded px-2 py-0.5"
                    >
                      <Text className="text-gold text-[9px]">+ EAN-13</Text>
                    </Pressable>
                  )}
                </View>
                <Text className="text-foreground text-xs self-center">
                  {p.price_opt != null ? `${p.price_opt.toFixed(0)} din` : '—'}
                </Text>
              </Pressable>
            </Swipeable>
          );
        }}
        ListEmptyComponent={
          <Text className="text-[#555] text-center mt-8">Товары не найдены</Text>
        }
      />
    </SafeAreaView>
  );
}
