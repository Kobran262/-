import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Modal,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { eq } from 'drizzle-orm';
import {
  getInventoryActById,
  getInventoryLines,
  updateInventoryLine,
  closeInventoryAct,
  addInventoryLine,
  getProductsForAct,
  getProductByBarcode,
} from '@/src/db/queries';
import { getDb } from '@/src/db/client';
import { inventory_acts } from '@/src/db/schema';
import {
  generateInventoryPdf,
  sharePdf,
  type InventoryPdfData,
} from '@/src/services/pdf/generator';
import { uploadInventoryPdfToDrive } from '@/src/services/gdrive/uploader';
import { WAREHOUSES, type WarehouseId } from '@/src/types';
import { BackArrow } from '@/src/components/ui/BackArrow';

const WAREHOUSE_ORDER: WarehouseId[] = ['WH-01', 'WH-02', 'WH-03', 'WH-04'];

type DisplayMode = 'filled' | 'diff_only' | 'all';
type InventoryLine = Awaited<ReturnType<typeof getInventoryLines>>[number];

function isFilled(line: InventoryLine): boolean {
  return (
    (line.qty_diff ?? 0) !== 0 ||
    (line.reason ?? '') !== '' ||
    line.manually_entered === true
  );
}

export default function InventoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [act, setAct] = useState<Awaited<ReturnType<typeof getInventoryActById>> | null>(null);
  const [lines, setLines] = useState<InventoryLine[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    'WH-01': true,
    'WH-02': true,
    'WH-03': true,
    'WH-04': true,
  });
  const [displayMode, setDisplayMode] = useState<DisplayMode>('filled');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addWarehouse, setAddWarehouse] = useState<WarehouseId>('WH-01');
  const [addSearch, setAddSearch] = useState('');
  const [addQty, setAddQty] = useState('0');
  const [addProducts, setAddProducts] = useState<Awaited<ReturnType<typeof getProductsForAct>>>([]);
  const [showAddScanner, setShowAddScanner] = useState(false);
  const [addScanned, setAddScanned] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

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

  useEffect(() => {
    if (search.trim() && displayMode === 'filled') {
      setDisplayMode('all');
    }
  }, [search]);

  const visibleLines = useMemo(() => {
    switch (displayMode) {
      case 'filled':
        return lines.filter(isFilled);
      case 'diff_only':
        return lines.filter((l) => (l.qty_diff ?? 0) !== 0);
      case 'all':
        return lines;
    }
  }, [lines, displayMode]);

  const searchedLines = useMemo(() => {
    if (!search.trim()) return visibleLines;
    const q = search.toLowerCase();
    return visibleLines.filter(
      (l) =>
        l.product_name.toLowerCase().includes(q) || l.sku.toLowerCase().includes(q)
    );
  }, [visibleLines, search]);

  const searchAddProducts = async (q: string) => {
    setAddSearch(q);
    setAddProducts(await getProductsForAct({ actType: 'inventory' }, q));
  };

  const openAddModal = async () => {
    setAddSearch('');
    setAddQty('0');
    setAddWarehouse('WH-01');
    setAddProducts(await getProductsForAct({ actType: 'inventory' }));
    setShowAddModal(true);
  };

  const handleAddProduct = async (product: (typeof addProducts)[number]) => {
    if (!id) return;
    const qty = parseFloat(addQty) || 0;
    await addInventoryLine(id, {
      sku: product.id,
      product_name: product.name,
      warehouse: addWarehouse,
      unit: 'шт',
      qty_actual: qty,
    });
    setShowAddModal(false);
    await load();
  };

  const handleAddBarcode = async (barcode: string) => {
    const product = await getProductByBarcode(barcode);
    if (!product) {
      Alert.alert('Не найден', `Товар с штрихкодом ${barcode} не найден`);
      return;
    }
    setShowAddScanner(false);
    await handleAddProduct({ ...product, priority: 0 });
  };

  const handleQtyChange = async (lineId: string, val: string) => {
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

  const buildPdfData = (): InventoryPdfData | null => {
    if (!act) return null;
    return {
      act: {
        number: act.number,
        period_month: act.period_month,
        period_year: act.period_year,
        date_start: act.date_start,
        date_end: act.date_end ?? undefined,
        commission: act.commission ?? undefined,
        status: act.status,
      },
      lines: lines.map((l) => ({
        sku: l.sku,
        product_name: l.product_name,
        warehouse: l.warehouse,
        unit: l.unit,
        qty_accounting: l.qty_accounting ?? 0,
        qty_actual: l.qty_actual ?? 0,
        qty_diff: l.qty_diff ?? 0,
        diff_pct: l.diff_pct ?? 0,
        reason: l.reason ?? undefined,
      })),
    };
  };

  const handlePdf = async () => {
    const pdfData = buildPdfData();
    if (!pdfData || !act) return;
    setLoading(true);
    try {
      const path = await generateInventoryPdf(pdfData);
      const db = getDb();
      await db.update(inventory_acts).set({ pdf_path: path }).where(eq(inventory_acts.id, act.id));
      await load();
      await sharePdf(path);
    } catch (e) {
      Alert.alert('Ошибка PDF', e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleDriveUpload = async () => {
    if (!act) return;
    setLoading(true);
    try {
      let pdfPath = act.pdf_path;
      if (!pdfPath) {
        const pdfData = buildPdfData();
        if (!pdfData) return;
        pdfPath = await generateInventoryPdf(pdfData);
        const db = getDb();
        await db.update(inventory_acts).set({ pdf_path: pdfPath }).where(eq(inventory_acts.id, act.id));
      }

      const driveId = await uploadInventoryPdfToDrive(pdfPath, {
        number: act.number,
        period_year: act.period_year,
        period_month: act.period_month,
      });

      const db = getDb();
      await db.update(inventory_acts).set({ gdrive_id: driveId }).where(eq(inventory_acts.id, act.id));
      await load();
      Alert.alert('Готово', 'Ведомость загружена в Google Drive');
    } catch (e) {
      Alert.alert('Ошибка Drive', e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!act?.pdf_path) {
      Alert.alert('Сначала сгенерируйте PDF');
      return;
    }
    await sharePdf(act.pdf_path);
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
          <Text className="text-[17px] text-foreground font-medium">{act.number}</Text>
          <Text className="text-[11px] text-[#555]">
            {act.status === 'closed' ? 'Закрыта' : 'Черновик'} · {lines.length} поз.
          </Text>
        </View>
      </View>

      <View className="px-5 pb-3 flex-row gap-2">
        {(
          [
            { mode: 'filled' as const, label: 'Заполненные' },
            { mode: 'diff_only' as const, label: 'С отклонением' },
            { mode: 'all' as const, label: 'Все позиции' },
          ] as const
        ).map(({ mode, label }) => (
          <Pressable
            key={mode}
            onPress={() => setDisplayMode(mode)}
            className={`flex-1 py-1.5 rounded-lg border items-center ${
              displayMode === mode ? 'border-gold bg-gold/10' : 'border-border bg-surface'
            }`}
          >
            <Text className={`text-xs ${displayMode === mode ? 'text-gold' : 'text-[#888]'}`}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="mx-5 mb-3 bg-surface border border-border rounded-xl px-3.5 flex-row items-center gap-2">
        <Text className="text-[#555]">🔍</Text>
        <TextInput
          className="flex-1 text-foreground text-sm py-2.5"
          value={search}
          onChangeText={setSearch}
          placeholder="Поиск по названию или SKU..."
          placeholderTextColor="#444"
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView className="flex-1 px-5">
        {WAREHOUSE_ORDER.map((wh) => {
          const whAllLines = lines.filter((l) => l.warehouse === wh);
          const whFilledLines = whAllLines.filter(isFilled);
          const whDiffLines = whAllLines.filter((l) => (l.qty_diff ?? 0) !== 0);
          const whLines = searchedLines.filter((l) => l.warehouse === wh);
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
                <Text className="text-[#888] text-xs">
                  {expanded[wh] ? '▾' : '▸'} {whFilledLines.length}/{whAllLines.length} ·{' '}
                  {whDiffLines.length} откл.
                </Text>
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
                            onChangeText={(val) => handleQtyChange(line.id, val)}
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
                        <Text className={`text-xs ${hasDiff ? 'text-danger' : 'text-success'}`}>
                          {line.qty_diff != null && line.qty_diff > 0 ? '+' : ''}
                          {line.qty_diff ?? 0} ({(line.diff_pct ?? 0).toFixed(1)}%)
                        </Text>
                      </View>

                      {showReason && isDraft && (
                        <View className="mt-2">
                          <Text className="text-[10px] text-danger mb-1">
                            Причина отклонения (&gt;5%)
                          </Text>
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

              {isDraft && expanded[wh] && (
                <Pressable
                  onPress={openAddModal}
                  className="bg-surface border-x border-b border-border rounded-b-xl px-4 py-3 items-center"
                >
                  <Text className="text-gold text-sm">+ Добавить позицию</Text>
                </Pressable>
              )}
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

      {act.status === 'closed' && (
        <View className="px-5 py-3 bg-background border-t border-[#1f1f1f] gap-2">
          <Pressable
            onPress={handlePdf}
            disabled={loading}
            className="bg-gold rounded-xl py-3.5 items-center"
          >
            <Text className="text-background font-medium">
              {loading ? '…' : 'Сгенерировать PDF'}
            </Text>
          </Pressable>
          <View className="flex-row gap-2">
            <Pressable
              onPress={handleDriveUpload}
              disabled={loading}
              className="flex-1 bg-surface border border-border rounded-xl py-3 items-center"
            >
              <Text className="text-[#888] text-sm">
                {act.gdrive_id ? '✓ Drive' : 'Загрузить в Drive'}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleShare}
              className="flex-1 bg-surface border border-border rounded-xl py-3 items-center"
            >
              <Text className="text-[#888] text-sm">Поделиться</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Modal visible={showAddModal} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-background rounded-t-2xl max-h-[85%]">
            <View className="px-5 py-4 border-b border-border flex-row justify-between items-center">
              <Text className="text-foreground text-lg font-medium">Добавить позицию</Text>
              <Pressable onPress={() => setShowAddModal(false)}>
                <Text className="text-gold">Закрыть</Text>
              </Pressable>
            </View>

            <ScrollView className="px-5 py-3">
              <Text className="text-[10px] text-[#555] uppercase mb-2">Склад</Text>
              <View className="flex-row gap-2 mb-4">
                {WAREHOUSE_ORDER.map((wh) => (
                  <Pressable
                    key={wh}
                    onPress={() => setAddWarehouse(wh)}
                    className={`flex-1 py-1.5 rounded-lg border items-center ${
                      addWarehouse === wh ? 'border-gold bg-gold/10' : 'border-border bg-surface'
                    }`}
                  >
                    <Text
                      className={`text-xs ${addWarehouse === wh ? 'text-gold' : 'text-[#888]'}`}
                    >
                      {wh}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                className="bg-surface border border-border rounded-xl px-3 py-2.5 text-foreground text-sm mb-2"
                value={addSearch}
                onChangeText={searchAddProducts}
                placeholder="Поиск товара..."
                placeholderTextColor="#444"
              />

              <Pressable
                onPress={async () => {
                  if (!cameraPermission?.granted) await requestCameraPermission();
                  setAddScanned(false);
                  setShowAddScanner(true);
                }}
                className="bg-surface border border-border rounded-xl py-2.5 items-center mb-3"
              >
                <Text className="text-gold text-sm">Сканировать штрихкод</Text>
              </Pressable>

              <Text className="text-[10px] text-[#555] uppercase mb-2">Кол-во факт</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-3 py-2.5 text-foreground text-sm mb-3"
                value={addQty}
                onChangeText={setAddQty}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#444"
              />

              {addProducts.slice(0, 15).map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => handleAddProduct(p)}
                  className="py-2 border-b border-border"
                >
                  <Text className="text-gold text-[9px]">{p.id}</Text>
                  <Text className="text-foreground text-sm">{p.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showAddScanner} animationType="slide">
        <SafeAreaView className="flex-1 bg-background">
          <View className="px-4 py-3 flex-row justify-between items-center">
            <Text className="text-foreground text-lg">Сканер</Text>
            <Pressable onPress={() => setShowAddScanner(false)}>
              <Text className="text-gold">Закрыть</Text>
            </Pressable>
          </View>
          {cameraPermission?.granted ? (
            <View className="flex-1 mx-4 rounded-2xl overflow-hidden mb-4">
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'qr', 'datamatrix'],
                }}
                onBarcodeScanned={
                  addScanned
                    ? undefined
                    : ({ data }) => {
                        setAddScanned(true);
                        handleAddBarcode(data);
                      }
                }
              />
            </View>
          ) : (
            <View className="flex-1 items-center justify-center">
              <Pressable onPress={requestCameraPermission} className="bg-gold rounded-xl px-4 py-3">
                <Text className="text-background">Разрешить камеру</Text>
              </Pressable>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
