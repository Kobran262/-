import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Alert, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  getActById,
  getActLines,
  addActLine,
  closeAct,
  getProductsForAct,
  updateActLine,
} from '@/src/db/queries';
import { generateActPdf, sharePdf } from '@/src/services/pdf/generator';
import { exportActsCsv, shareCsv } from '@/src/services/csv/exporter';
import { uploadPdfToDrive } from '@/src/services/gdrive/uploader';
import { isGoogleConnected } from '@/src/services/gdrive/auth';
import { useSettingsStore } from '@/src/store/settingsStore';
import { StepIndicator } from '@/src/components/ui/StepIndicator';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { ACT_TYPE_LABELS } from '@/src/types';
import type { ActStatus, ActType, WarehouseId } from '@/src/types';
import type { ProductQueryContext } from '@/src/utils/productContext';
import { getDb } from '@/src/db/client';
import { acts } from '@/src/db/schema';
import { eq } from 'drizzle-orm';

export default function ActDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { gdriveAutoUpload } = useSettingsStore();
  const [act, setAct] = useState<Awaited<ReturnType<typeof getActById>> | null>(null);
  const [lines, setLines] = useState<Awaited<ReturnType<typeof getActLines>>>([]);
  const [showAddLine, setShowAddLine] = useState(false);
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Awaited<ReturnType<typeof getProductsForAct>>>([]);
  const [signature, setSignature] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setAct(await getActById(id));
    setLines(await getActLines(id));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const buildContext = (actData: NonNullable<typeof act>): ProductQueryContext => ({
    actType: actData.type as ActType,
    transferFrom: actData.warehouse_from as WarehouseId | undefined,
    transferTo: actData.warehouse_to as WarehouseId | undefined,
    packagingType: actData.packaging_type ?? undefined,
    channel: actData.channel ?? undefined,
  });

  const searchProducts = async (q: string) => {
    setSearch(q);
    if (!act) return;
    setProducts(await getProductsForAct(buildContext(act), q));
  };

  const openAddLine = async () => {
    if (!act) return;
    setShowAddLine(true);
    setProducts(await getProductsForAct(buildContext(act)));
  };

  const handleAddLine = async (product: Awaited<ReturnType<typeof getProductsForAct>>[number]) => {
    if (!id || !act) return;
    await addActLine(
      id,
      {
        sku: product.id,
        product_name: product.name,
        category: product.category,
        unit: 'шт',
        qty_planned: 1,
        qty_actual: 1,
        price_unit: product.price_opt ?? product.price_rrp ?? 0,
      },
      lines.length + 1
    );
    setShowAddLine(false);
    setSearch('');
    load();
  };

  const handleQtyChange = async (
    line: Awaited<ReturnType<typeof getActLines>>[number],
    val: string
  ) => {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    await updateActLine(line.id, {
      qty_actual: num,
      qty_planned: line.qty_planned ?? undefined,
      price_unit: line.price_unit ?? undefined,
    });
    load();
  };

  const handleConditionChange = async (
    line: Awaited<ReturnType<typeof getActLines>>[number],
    condition: string
  ) => {
    await updateActLine(line.id, {
      qty_actual: line.qty_actual ?? undefined,
      qty_planned: line.qty_planned ?? undefined,
      price_unit: line.price_unit ?? undefined,
      condition,
    });
    load();
  };

  const uploadToDrive = async (actData: NonNullable<typeof act>, pdfPath: string) => {
    const driveFileId = await uploadPdfToDrive(pdfPath, {
      number: actData.number,
      type: actData.type,
      date: actData.date,
    });
    const db = getDb();
    await db.update(acts).set({ gdrive_id: driveFileId }).where(eq(acts.id, actData.id));
    await load();
  };

  const handleClose = () => {
    Alert.alert('Закрыть акт?', 'После закрытия редактирование будет невозможно', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Закрыть',
        onPress: async () => {
          if (!id) return;
          setLoading(true);
          await closeAct(id, signature || undefined);
          const updatedAct = await getActById(id);
          const updatedLines = await getActLines(id);

          if (gdriveAutoUpload && updatedAct && (await isGoogleConnected())) {
            try {
              const path = await generateActPdf(
                updatedAct as Parameters<typeof generateActPdf>[0],
                updatedLines as Parameters<typeof generateActPdf>[1]
              );
              await uploadToDrive(updatedAct, path);
            } catch {
              // Автозагрузка не блокирует закрытие акта
            }
          }

          await load();
          setLoading(false);
        },
      },
    ]);
  };

  const handlePdf = async () => {
    if (!act) return;
    setLoading(true);
    try {
      const path = await generateActPdf(
        act as Parameters<typeof generateActPdf>[0],
        lines as Parameters<typeof generateActPdf>[1]
      );
      const db = getDb();
      await db.update(acts).set({ pdf_path: path }).where(eq(acts.id, act.id));
      await sharePdf(path);
    } catch (e) {
      Alert.alert('Ошибка PDF', e instanceof Error ? e.message : 'Не удалось создать PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleDriveUpload = async () => {
    if (!act) return;

    const connected = await isGoogleConnected();
    if (!connected) {
      Alert.alert('Google Drive', 'Подключите Google Drive в настройках');
      return;
    }

    setLoading(true);
    try {
      const path =
        act.pdf_path ??
        (await generateActPdf(
          act as Parameters<typeof generateActPdf>[0],
          lines as Parameters<typeof generateActPdf>[1]
        ));
      await uploadToDrive(act, path);
      Alert.alert('Готово', 'PDF загружен в Google Drive');
    } catch (e) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось загрузить в Drive');
    } finally {
      setLoading(false);
    }
  };

  if (!act) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Text className="text-[#555]">Загрузка...</Text>
      </SafeAreaView>
    );
  }

  const total = lines.reduce((s, l) => s + (l.amount ?? 0), 0);
  const isDraft = act.status === 'draft';
  const diffLines = lines.filter((l) => l.qty_diff != null && l.qty_diff !== 0);
  const typeLabel = ACT_TYPE_LABELS[act.type as keyof typeof ACT_TYPE_LABELS]?.split('(')[0].trim();

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
          <Text className="text-[11px] text-[#555]">{typeLabel}</Text>
        </View>
        <StatusBadge status={act.status as ActStatus} />
      </View>

      {isDraft && (
        <View className="bg-content px-5 pt-2">
          <StepIndicator current={3} />
        </View>
      )}

      <ScrollView className="flex-1 bg-content px-5">
        {act.warehouse_from && act.warehouse_to && (
          <View className="mb-3">
            <Text className="text-[11px] text-[#555] uppercase tracking-widest mb-2">Маршрут</Text>
            <View className="bg-surface rounded-[10px] border border-border p-3 flex-row items-center gap-2">
              <Text className="text-gold text-xs font-medium bg-gold/10 border border-gold/25 rounded px-2 py-1">
                {act.warehouse_from}
              </Text>
              <Text className="text-[#555]">→</Text>
              <Text className="text-gold text-xs font-medium bg-gold/10 border border-gold/25 rounded px-2 py-1">
                {act.warehouse_to}
              </Text>
            </View>
          </View>
        )}

        <View className="flex-row justify-between items-center mb-2.5">
          <Text className="text-[11px] text-[#555] uppercase tracking-widest">
            Позиции · {lines.length}
          </Text>
          <Text className="text-[11px] text-gold">Итого: {total.toFixed(2)} din</Text>
        </View>

        {lines.map((line) => {
          const hasDiff = line.qty_diff != null && line.qty_diff !== 0;
          return (
            <View
              key={line.id}
              className={`bg-surface rounded-[10px] border p-3.5 mb-2 ${
                hasDiff ? 'border-danger/30' : 'border-border'
              }`}
            >
              <View className="flex-row items-start gap-2.5">
                <View className="flex-1">
                  <Text
                    className={`text-[9px] tracking-wide mb-0.5 ${hasDiff ? 'text-danger' : 'text-gold'}`}
                  >
                    {line.sku}
                  </Text>
                  <Text className="text-[13px] text-foreground">{line.product_name}</Text>
                  <Text className="text-[11px] text-[#555] mt-0.5">
                    {line.category} · {line.unit}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-[11px] text-[#555]">план {line.qty_planned}</Text>
                  {isDraft ? (
                    <TextInput
                      className="text-[13px] text-foreground font-medium bg-background border border-border rounded px-2 py-0.5 min-w-[60px] text-right mt-0.5"
                      value={String(line.qty_actual ?? '')}
                      keyboardType="numeric"
                      onChangeText={(val) => handleQtyChange(line, val)}
                    />
                  ) : (
                    <Text className="text-[13px] text-foreground font-medium">
                      факт {line.qty_actual}
                    </Text>
                  )}
                  {hasDiff && (
                    <Text className="text-[11px] text-danger">
                      откл. {line.qty_diff! > 0 ? '+' : ''}
                      {line.qty_diff}
                    </Text>
                  )}
                </View>
              </View>

              {isDraft && act.type === 'transfer' && (
                <View className="flex-row gap-2 mt-2">
                  {(['Норма', 'Брак'] as const).map((cond) => (
                    <Pressable
                      key={cond}
                      onPress={() => handleConditionChange(line, cond)}
                      className={`px-3 py-1 rounded-lg border ${
                        (line.condition ?? 'Норма') === cond
                          ? cond === 'Брак'
                            ? 'border-danger bg-danger/10'
                            : 'border-success bg-success/10'
                          : 'border-border'
                      }`}
                    >
                      <Text
                        className={`text-xs ${
                          (line.condition ?? 'Норма') === cond
                            ? cond === 'Брак'
                              ? 'text-danger'
                              : 'text-success'
                            : 'text-[#888]'
                        }`}
                      >
                        {cond}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {isDraft && (
          <>
            {showAddLine ? (
              <View className="bg-surface rounded-[10px] border border-border p-3 mb-2">
                <TextInput
                  className="text-foreground text-sm mb-2"
                  placeholder="Поиск товара..."
                  placeholderTextColor="#444"
                  value={search}
                  onChangeText={searchProducts}
                  autoFocus
                />
                {(() => {
                  let lastPriority = -1;
                  return products.slice(0, 12).map((p) => {
                    const showDivider = p.priority !== lastPriority && lastPriority !== -1;
                    lastPriority = p.priority;
                    return (
                      <View key={p.id}>
                        {showDivider && <View className="border-t border-border my-1" />}
                        <Pressable
                          onPress={() => handleAddLine(p)}
                          className="py-2 border-b border-border"
                        >
                          <Text className="text-gold text-[9px]">{p.id}</Text>
                          <Text className="text-foreground text-sm">{p.name}</Text>
                          <Text className="text-[#555] text-[10px]">
                            {p.category} · {p.packaging}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  });
                })()}
                <Pressable onPress={() => setShowAddLine(false)} className="mt-2">
                  <Text className="text-gold text-center text-sm">Отмена</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={openAddLine}
                className="border border-dashed border-border rounded-[10px] p-3 flex-row items-center justify-center gap-2 mb-2"
              >
                <Text className="text-[#444] text-lg">＋</Text>
                <Text className="text-[13px] text-[#555]">Добавить позицию или сканировать</Text>
              </Pressable>
            )}

            {diffLines.length > 0 && (
              <View className="bg-danger/10 border border-danger/25 rounded-[10px] p-3 flex-row gap-2.5 mb-3">
                <Text className="text-base">⚠️</Text>
                <View>
                  <Text className="text-[12px] font-medium text-danger">
                    Расхождение в {diffLines.length} позиции
                  </Text>
                  <Text className="text-[11px] text-danger/70 mt-0.5">
                    {diffLines[0].product_name}: {diffLines[0].qty_diff! > 0 ? '+' : ''}
                    {diffLines[0].qty_diff}. Укажите причину.
                  </Text>
                </View>
              </View>
            )}

            <View className="bg-surface rounded-[10px] border border-border px-3.5 py-2.5 mb-3">
              <Text className="text-[10px] text-[#555] uppercase tracking-wide mb-1">
                Подпись (ФИО)
              </Text>
              <TextInput
                className="text-sm text-foreground p-0"
                value={signature}
                onChangeText={setSignature}
                placeholder="Иван И."
                placeholderTextColor="#444"
              />
            </View>
          </>
        )}

        {act.status === 'closed' && (
          <View className="gap-2 mb-4">
            <Pressable onPress={handlePdf} className="bg-gold rounded-xl py-3.5 items-center">
              <Text className="text-background font-medium">
                {loading ? '…' : 'Сгенерировать PDF'}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleDriveUpload}
              className="bg-surface border border-border rounded-xl py-3.5 items-center"
            >
              <Text className="text-[#888]">
                {act.gdrive_id ? '✓ Загружено в Drive' : 'Загрузить в Google Drive'}
              </Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                setLoading(true);
                await shareCsv(await exportActsCsv());
                setLoading(false);
              }}
              className="bg-surface border border-border rounded-xl py-3.5 items-center"
            >
              <Text className="text-[#888]">Экспорт CSV</Text>
            </Pressable>
          </View>
        )}
        <View className="h-24" />
      </ScrollView>

      {isDraft && (
        <View className="px-5 py-3 bg-background border-t border-[#1f1f1f] flex-row gap-2.5">
          <Pressable
            onPress={() => router.back()}
            className="flex-1 bg-surface border border-border rounded-xl py-3.5 items-center"
          >
            <Text className="text-[#888] text-sm">Черновик</Text>
          </Pressable>
          <Pressable
            onPress={handleClose}
            disabled={loading || lines.length === 0}
            className={`flex-[2] rounded-xl py-3.5 items-center ${lines.length > 0 ? 'bg-gold' : 'bg-gold/40'}`}
          >
            <Text className="text-background text-sm font-medium">
              {loading ? 'Закрытие…' : 'Закрыть акт →'}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
