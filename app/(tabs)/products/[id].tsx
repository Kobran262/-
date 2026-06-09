import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Modal,
  StyleSheet,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { getProductBySku, createProduct, updateProduct } from '@/src/db/queries';
import { ALL_CATEGORIES, ALL_CHANNELS } from '@/src/utils/productContext';
import { WAREHOUSES, type WarehouseId } from '@/src/types';
import { BackArrow } from '@/src/components/ui/BackArrow';

type Mode = 'view' | 'edit' | 'new';

function generateEan13(): string {
  const prefix = '860';
  const rand = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
  const base = prefix + rand;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return base + check;
}

export default function ProductDetailScreen() {
  const { id, mode: modeParam } = useLocalSearchParams<{ id: string; mode?: string }>();
  const router = useRouter();
  const mode: Mode = modeParam === 'new' || id === 'new' ? 'new' : modeParam === 'edit' ? 'edit' : 'view';
  const readonly = mode === 'view';

  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const [form, setForm] = useState({
    id: '',
    name: '',
    name_ru: '',
    category: ALL_CATEGORIES[0],
    channel: ALL_CHANNELS[0],
    packaging: '',
    weight_g: '',
    price_rrp: '',
    price_opt: '',
    discount_pct: '0',
    warehouse: 'WH-01' as WarehouseId,
    barcode: '',
    notes: '',
    is_active: true,
    is_material: false,
  });

  const load = useCallback(async () => {
    if (mode === 'new' || !id || id === 'new') return;
    const product = await getProductBySku(id);
    if (!product) {
      Alert.alert('Ошибка', 'Товар не найден');
      router.back();
      return;
    }
    setForm({
      id: product.id,
      name: product.name,
      name_ru: product.name_ru ?? '',
      category: product.category,
      channel: product.channel,
      packaging: product.packaging,
      weight_g: product.weight_g != null ? String(product.weight_g) : '',
      price_rrp: product.price_rrp != null ? String(product.price_rrp) : '',
      price_opt: product.price_opt != null ? String(product.price_opt) : '',
      discount_pct: product.discount_pct != null ? String(product.discount_pct) : '0',
      warehouse: product.warehouse as WarehouseId,
      barcode: product.barcode ?? '',
      notes: product.notes ?? '',
      is_active: product.is_active ?? true,
      is_material: product.is_material ?? false,
    });
  }, [id, mode, router]);

  useEffect(() => {
    load();
  }, [load]);

  const rrp = parseFloat(form.price_rrp) || 0;
  const discount = parseFloat(form.discount_pct) || 0;
  const priceOpt = form.price_opt ? parseFloat(form.price_opt) : rrp * (1 - discount / 100);
  const priceOptNoVat = priceOpt / 1.2;
  const vatAmount = priceOpt - priceOptNoVat;

  const updateField = (key: keyof typeof form, value: string | boolean) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleRrpChange = (val: string) => {
    const r = parseFloat(val) || 0;
    const d = parseFloat(form.discount_pct) || 0;
    setForm((f) => ({
      ...f,
      price_rrp: val,
      price_opt: String(r * (1 - d / 100)),
    }));
  };

  const handleDiscountChange = (val: string) => {
    const r = parseFloat(form.price_rrp) || 0;
    const d = parseFloat(val) || 0;
    setForm((f) => ({
      ...f,
      discount_pct: val,
      price_opt: String(r * (1 - d / 100)),
    }));
  };

  const handleSave = async () => {
    if (!form.id.trim() || !form.name.trim()) {
      Alert.alert('Ошибка', 'SKU и название обязательны');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        name_ru: form.name_ru.trim() || null,
        category: form.category,
        channel: form.channel,
        packaging: form.packaging.trim() || '—',
        weight_g: form.weight_g ? parseFloat(form.weight_g) : null,
        price_rrp: rrp || null,
        price_opt: priceOpt || null,
        price_opt_no_vat: priceOptNoVat || null,
        vat_amount: vatAmount || null,
        discount_pct: discount || null,
        warehouse: form.warehouse,
        barcode: form.barcode.trim() || null,
        is_material: form.is_material,
        is_active: form.is_active,
        notes: form.notes.trim() || null,
      };

      if (mode === 'new') {
        await createProduct({ id: form.id.trim(), ...payload });
      } else {
        await updateProduct(form.id, payload);
      }
      Alert.alert('Готово', 'Сохранено');
      router.back();
    } catch (e) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setLoading(false);
    }
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      await requestPermission();
    }
    setScanned(false);
    setShowScanner(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="px-5 pt-2 pb-3 flex-row items-center gap-3">
        <Pressable
          onPress={() => router.back()}
          className="w-[34px] h-[34px] rounded-[10px] bg-surface border border-border items-center justify-center"
        >
          <BackArrow />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[17px] text-foreground font-medium">
            {mode === 'new' ? 'Новый товар' : form.id || 'Товар'}
          </Text>
          <Text className="text-[11px] text-[#555]">
            {mode === 'view' ? 'Просмотр' : mode === 'edit' ? 'Редактирование' : 'Создание'}
          </Text>
        </View>
        {mode === 'view' && (
          <Pressable
            onPress={() =>
              router.setParams({ mode: 'edit' })
            }
            className="bg-surface border border-border rounded-[10px] px-3 py-2"
          >
            <Text className="text-gold text-sm">Изменить</Text>
          </Pressable>
        )}
      </View>

      <ScrollView className="flex-1 px-5">
        <Field label="SKU (id)" readonly={mode !== 'new'}>
          <TextInput
            className="text-foreground font-mono text-sm"
            style={{ minHeight: 44, textAlignVertical: 'center' }}
            value={form.id}
            editable={mode === 'new'}
            onChangeText={(v) => updateField('id', v)}
            placeholder="GF-W-BMD210"
            placeholderTextColor="#444"
          />
        </Field>

        <Field label="Название">
          <TextInput
            className="text-foreground text-sm"
            style={{ minHeight: 44, textAlignVertical: 'center' }}
            value={form.name}
            editable={!readonly}
            onChangeText={(v) => updateField('name', v)}
            placeholderTextColor="#444"
          />
        </Field>

        <Field label="Название (рус.)">
          <TextInput
            className="text-foreground text-sm"
            style={{ minHeight: 44, textAlignVertical: 'center' }}
            value={form.name_ru}
            editable={!readonly}
            onChangeText={(v) => updateField('name_ru', v)}
            placeholderTextColor="#444"
          />
        </Field>

        <Text className="text-[10px] text-[#555] uppercase tracking-wide mb-1 mt-2">Категория</Text>
        <View className="flex-row flex-wrap gap-1.5 mb-3">
          {ALL_CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              disabled={readonly}
              onPress={() => updateField('category', cat)}
              className={`px-2 py-1 rounded-md border ${
                form.category === cat ? 'border-gold bg-gold/10' : 'border-border bg-surface'
              }`}
            >
              <Text className={`text-[10px] ${form.category === cat ? 'text-gold' : 'text-[#888]'}`}>
                {cat}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text className="text-[10px] text-[#555] uppercase tracking-wide mb-1">Канал</Text>
        <View className="flex-row flex-wrap gap-1.5 mb-3">
          {ALL_CHANNELS.map((ch) => (
            <Pressable
              key={ch}
              disabled={readonly}
              onPress={() => updateField('channel', ch)}
              className={`px-2 py-1 rounded-md border ${
                form.channel === ch ? 'border-gold bg-gold/10' : 'border-border bg-surface'
              }`}
            >
              <Text className={`text-[10px] ${form.channel === ch ? 'text-gold' : 'text-[#888]'}`}>
                {ch}
              </Text>
            </Pressable>
          ))}
        </View>

        <Field label="Тип упаковки">
          <TextInput
            className="text-foreground text-sm"
            style={{ minHeight: 44, textAlignVertical: 'center' }}
            value={form.packaging}
            editable={!readonly}
            onChangeText={(v) => updateField('packaging', v)}
            placeholder="Тубус 210г / Зип-лок 210г"
            placeholderTextColor="#444"
          />
        </Field>

        <Field label="Вес, г">
          <TextInput
            className="text-foreground text-sm"
            style={{ minHeight: 44, textAlignVertical: 'center' }}
            value={form.weight_g}
            editable={!readonly}
            keyboardType="numeric"
            onChangeText={(v) => updateField('weight_g', v)}
            placeholderTextColor="#444"
          />
        </Field>

        <Field label="РРЦ с НДС, din">
          <TextInput
            className="text-foreground text-sm"
            style={{ minHeight: 44, textAlignVertical: 'center' }}
            value={form.price_rrp}
            editable={!readonly}
            keyboardType="numeric"
            onChangeText={handleRrpChange}
            placeholderTextColor="#444"
          />
        </Field>

        <Field label="Цена опт с НДС">
          <TextInput
            className="text-foreground text-sm"
            style={{ minHeight: 44, textAlignVertical: 'center' }}
            value={String(priceOpt.toFixed(2))}
            editable={!readonly}
            keyboardType="numeric"
            onChangeText={(v) => updateField('price_opt', v)}
            placeholderTextColor="#444"
          />
        </Field>

        <Field label="Цена опт без НДС" readonly>
          <Text className="text-foreground text-sm">{priceOptNoVat.toFixed(2)}</Text>
        </Field>

        <Field label="НДС сумма" readonly>
          <Text className="text-foreground text-sm">{vatAmount.toFixed(2)}</Text>
        </Field>

        <Field label="Скидка опт %">
          <TextInput
            className="text-foreground text-sm"
            style={{ minHeight: 44, textAlignVertical: 'center' }}
            value={form.discount_pct}
            editable={!readonly}
            keyboardType="numeric"
            onChangeText={handleDiscountChange}
            placeholderTextColor="#444"
          />
        </Field>

        <Text className="text-[10px] text-[#555] uppercase tracking-wide mb-1 mt-2">Склад</Text>
        <View className="flex-row flex-wrap gap-1.5 mb-3">
          {(Object.keys(WAREHOUSES) as WarehouseId[]).map((wh) => (
            <Pressable
              key={wh}
              disabled={readonly}
              onPress={() => updateField('warehouse', wh)}
              className={`px-2 py-1 rounded-md border ${
                form.warehouse === wh ? 'border-gold bg-gold/10' : 'border-border bg-surface'
              }`}
            >
              <Text className={`text-[10px] ${form.warehouse === wh ? 'text-gold' : 'text-[#888]'}`}>
                {wh}
              </Text>
            </Pressable>
          ))}
        </View>

        <View className="flex-row gap-2 items-end mb-2">
          <View className="flex-1">
            <Field label="Штрихкод">
              <View className="flex-row items-center gap-2">
                <TextInput
                  className="flex-1 text-foreground text-sm"
                  style={{ minHeight: 44, textAlignVertical: 'center' }}
                  value={form.barcode}
                  editable={!readonly}
                  onChangeText={(v) => updateField('barcode', v)}
                  placeholderTextColor="#444"
                />
                {!readonly && (
                  <Pressable
                    onPress={openScanner}
                    className="bg-gold/10 border border-gold/25 rounded px-2 py-2"
                  >
                    <Text className="text-gold text-xs">Сканировать</Text>
                  </Pressable>
                )}
              </View>
            </Field>
          </View>
          {(mode === 'new' || mode === 'edit') && (
            <Pressable
              onPress={() => updateField('barcode', generateEan13())}
              className="bg-surface border border-border rounded-lg px-3 py-2.5 mb-2"
            >
              <Text className="text-gold text-xs">EAN-13</Text>
            </Pressable>
          )}
        </View>

        <Field label="Примечание">
          <TextInput
            className="text-foreground text-sm"
            style={{ minHeight: 60, textAlignVertical: 'top' }}
            value={form.notes}
            editable={!readonly}
            multiline
            onChangeText={(v) => updateField('notes', v)}
            placeholderTextColor="#444"
          />
        </Field>

        <View className="flex-row items-center justify-between bg-surface border border-border rounded-[10px] px-3.5 py-3 mb-6">
          <Text className="text-foreground text-sm">Активен</Text>
          <Switch
            value={form.is_active}
            disabled={readonly}
            onValueChange={(v) => updateField('is_active', v)}
            trackColor={{ false: '#333', true: '#C8A96E' }}
          />
        </View>
      </ScrollView>

      {!readonly && (
        <View className="px-5 py-3 border-t border-[#1f1f1f]">
          <Pressable
            onPress={handleSave}
            disabled={loading}
            className="bg-gold rounded-xl py-3.5 items-center"
          >
            <Text className="text-background font-medium">{loading ? 'Сохранение…' : 'Сохранить'}</Text>
          </Pressable>
        </View>
      )}

      <Modal visible={showScanner} animationType="slide">
        <SafeAreaView className="flex-1 bg-background">
          <View className="px-4 py-3 flex-row justify-between items-center">
            <Text className="text-foreground text-lg">Сканер штрихкода</Text>
            <Pressable onPress={() => setShowScanner(false)}>
              <Text className="text-gold">Закрыть</Text>
            </Pressable>
          </View>
          {permission?.granted ? (
            <View className="flex-1 mx-4 rounded-2xl overflow-hidden mb-4">
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'qr', 'datamatrix'],
                }}
                onBarcodeScanned={
                  scanned
                    ? undefined
                    : ({ data }) => {
                        setScanned(true);
                        updateField('barcode', data);
                        setShowScanner(false);
                      }
                }
              />
            </View>
          ) : (
            <View className="flex-1 items-center justify-center">
              <Pressable onPress={requestPermission} className="bg-gold rounded-xl px-4 py-3">
                <Text className="text-background">Разрешить камеру</Text>
              </Pressable>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Field({
  label,
  children,
  readonly: ro,
}: {
  label: string;
  children: ReactNode;
  readonly?: boolean;
}) {
  return (
    <View className="mb-2">
      <Text className="text-[10px] text-[#555] uppercase tracking-wide mb-1 ml-0.5">
        {label}
        {ro ? ' · только чтение' : ''}
      </Text>
      <View
        className="bg-surface rounded-[10px] border border-border px-3.5"
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        {children}
      </View>
    </View>
  );
}
