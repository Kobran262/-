import { useCallback, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import { getProductsCatalog } from '@/src/db/queries';
import {
  exportBarcodesPdf,
  exportBarcodesCsv,
  shareBarcodeFile,
  renderBarcodePrintHtml,
  type BarcodeItem,
  type BarcodeFormat,
} from '@/src/services/barcode/generator';
import type { products } from '@/src/db/schema';

type Product = typeof products.$inferSelect;

export default function BarcodesScreen() {
  const router = useRouter();
  const [selectedItems, setSelectedItems] = useState<BarcodeItem[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [format, setFormat] = useState<BarcodeFormat>('EAN13');
  const [loading, setLoading] = useState(false);

  const searchProducts = useCallback(async (q: string) => {
    setSearch(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchResults(await getProductsCatalog({ search: q, includeInactive: false }));
  }, []);

  const addItem = (product: Product, barcode: string, fmt: BarcodeFormat) => {
    setSelectedItems((prev) => {
      const exists = prev.find((i) => i.sku === product.id);
      if (exists) {
        return prev.map((i) => (i.sku === product.id ? { ...i, copies: i.copies + 1 } : i));
      }
      return [
        ...prev,
        {
          sku: product.id,
          name: product.name,
          barcode,
          format: fmt,
          copies: 1,
        },
      ];
    });
    setSearch('');
    setSearchResults([]);
  };

  const handleAdd = (product: Product) => {
    if (!product.barcode) {
      Alert.alert(
        'Нет штрихкода',
        `У ${product.id} не привязан штрихкод.\nХотите использовать SKU как Code128?`,
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Использовать SKU',
            onPress: () => addItem(product, product.id, 'CODE128'),
          },
        ]
      );
      return;
    }
    const autoFormat: BarcodeFormat = /^\d{13}$/.test(product.barcode)
      ? 'EAN13'
      : /^\d{8}$/.test(product.barcode)
        ? 'EAN13'
        : 'CODE128';
    addItem(product, product.barcode, autoFormat);
  };

  const updateCopies = (sku: string, delta: number) => {
    setSelectedItems((prev) =>
      prev
        .map((i) => (i.sku === sku ? { ...i, copies: Math.max(1, i.copies + delta) } : i))
        .filter((i) => i.copies > 0)
    );
  };

  const removeItem = (sku: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.sku !== sku));
  };

  const handlePdf = async () => {
    if (selectedItems.length === 0) {
      Alert.alert('Добавьте товары');
      return;
    }
    setLoading(true);
    try {
      const items = selectedItems.map((i) => ({ ...i, format }));
      const path = await exportBarcodesPdf(items);
      await shareBarcodeFile(path);
    } catch (e) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCsv = async () => {
    if (selectedItems.length === 0) {
      Alert.alert('Добавьте товары');
      return;
    }
    try {
      const items = selectedItems.map((i) => ({ ...i, format }));
      const path = await exportBarcodesCsv(items);
      await shareBarcodeFile(path);
    } catch (e) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : String(e));
    }
  };

  const handlePrint = async () => {
    if (selectedItems.length === 0) {
      Alert.alert('Добавьте товары');
      return;
    }
    const items = selectedItems.map((i) => ({ ...i, format }));
    await Print.printAsync({ html: renderBarcodePrintHtml(items) });
  };

  const formats: { key: BarcodeFormat; label: string }[] = [
    { key: 'EAN13', label: 'EAN-13' },
    { key: 'CODE128', label: 'Code128' },
    { key: 'QR', label: 'QR' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-5 pt-2 pb-3 flex-row items-center gap-3">
        <Pressable
          onPress={() => router.back()}
          className="w-[34px] h-[34px] rounded-[10px] bg-surface border border-border items-center justify-center"
        >
          <Text className="text-[#888] text-lg">‹</Text>
        </Pressable>
        <Text className="text-[17px] text-foreground font-medium flex-1">Генератор штрихкодов</Text>
      </View>

      <ScrollView className="flex-1 px-5">
        <View className="mb-3 bg-surface border border-border rounded-xl px-3.5 flex-row items-center gap-2">
          <Text className="text-[#555]">🔍</Text>
          <TextInput
            className="flex-1 text-foreground text-sm py-2.5"
            style={{ minHeight: 44 }}
            value={search}
            onChangeText={searchProducts}
            placeholder="Поиск товаров для добавления..."
            placeholderTextColor="#444"
          />
        </View>

        {searchResults.slice(0, 8).map((p) => (
          <Pressable
            key={p.id}
            onPress={() => handleAdd(p)}
            className="bg-surface border border-border rounded-xl p-3 mb-2"
          >
            <Text className="text-gold text-[9px]">{p.id}</Text>
            <Text className="text-foreground text-sm">{p.name}</Text>
            <Text className="text-[#555] text-xs">{p.barcode ?? 'нет штрихкода'}</Text>
          </Pressable>
        ))}

        <Text className="text-[11px] text-[#555] uppercase tracking-widest mb-2 mt-2">
          Список для печати ({selectedItems.length})
        </Text>

        {selectedItems.map((item) => (
          <View key={item.sku} className="bg-surface border border-border rounded-xl p-3 mb-2">
            <View className="flex-row justify-between items-start">
              <View className="flex-1">
                <Text className="text-gold text-[9px]">{item.sku}</Text>
                <Text className="text-foreground text-sm">{item.name}</Text>
              </View>
              <Pressable onPress={() => removeItem(item.sku)}>
                <Text className="text-danger text-lg">✕</Text>
              </Pressable>
            </View>
            <View className="bg-white rounded border border-border p-2 items-center mt-2">
              <Text className="text-black font-mono text-xs tracking-widest">{item.barcode}</Text>
              <Text className="text-[#555] text-[9px] mt-0.5">
                {item.format} · {item.copies} шт.
              </Text>
            </View>
            <View className="flex-row items-center justify-center gap-4 mt-2">
              <Pressable onPress={() => updateCopies(item.sku, -1)} className="px-3 py-1 bg-background rounded">
                <Text className="text-foreground">−</Text>
              </Pressable>
              <Text className="text-foreground">{item.copies}</Text>
              <Pressable onPress={() => updateCopies(item.sku, 1)} className="px-3 py-1 bg-background rounded">
                <Text className="text-foreground">+</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <Text className="text-[11px] text-[#555] uppercase tracking-widest mb-2 mt-2">Формат</Text>
        <View className="flex-row gap-2 mb-4">
          {formats.map(({ key, label }) => (
            <Pressable
              key={key}
              onPress={() => setFormat(key)}
              className={`flex-1 py-2 rounded-lg border items-center ${
                format === key ? 'border-gold bg-gold/10' : 'border-border bg-surface'
              }`}
            >
              <Text className={`text-xs ${format === key ? 'text-gold' : 'text-[#888]'}`}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View className="gap-2 mb-8">
          <Pressable
            onPress={handlePdf}
            disabled={loading}
            className="bg-gold rounded-xl py-3.5 items-center"
          >
            <Text className="text-background font-medium">{loading ? '…' : 'Сохранить PDF'}</Text>
          </Pressable>
          <Pressable
            onPress={handleCsv}
            className="bg-surface border border-border rounded-xl py-3.5 items-center"
          >
            <Text className="text-[#888]">Сохранить CSV</Text>
          </Pressable>
          <Pressable
            onPress={handlePrint}
            className="bg-surface border border-border rounded-xl py-3.5 items-center"
          >
            <Text className="text-[#888]">Распечатать сейчас</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
