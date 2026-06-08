import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Alert, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { createAct, addActLine, getProductBySku } from '@/src/db/queries';
import { StepIndicator } from '@/src/components/ui/StepIndicator';
import { ACT_TYPE_LABELS, TRANSFER_ROUTES, WAREHOUSES } from '@/src/types';
import type { ActType, WarehouseId } from '@/src/types';
import { useAuthStore } from '@/src/store/authStore';
import { PACKAGING_TYPE_OPTIONS } from '@/src/utils/bom';
import { TYPE_OPTIONS } from '@/src/utils/actDisplay';

export default function NewActScreen() {
  const router = useRouter();
  const { prefill_sku } = useLocalSearchParams<{ prefill_sku?: string }>();
  const { currentUser } = useAuthStore();
  const [step, setStep] = useState(1);
  const [type, setType] = useState<ActType | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewNumber, setPreviewNumber] = useState('новый');
  const prefillDone = useRef(false);

  useEffect(() => {
    if (!prefill_sku || prefillDone.current) return;
    prefillDone.current = true;

    (async () => {
      const product = await getProductBySku(prefill_sku);
      if (!product) {
        Alert.alert('Ошибка', `Товар ${prefill_sku} не найден`);
        return;
      }

      setLoading(true);
      try {
        const { id, number } = await createAct({
          type: 'receipt',
          date: Date.now(),
          warehouse_to: 'WH-01',
          supplier: product.name,
          responsible_user: currentUser?.id,
          checked_by: currentUser?.id,
        });

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
          1
        );

        router.replace(`/(tabs)/acts/${id}`);
      } catch (e) {
        Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось создать акт');
        prefillDone.current = false;
      } finally {
        setLoading(false);
      }
    })();
  }, [prefill_sku, currentUser?.id, router]);

  const [form, setForm] = useState({
    supplier: '',
    invoice_number: '',
    warehouse_from: 'WH-01' as WarehouseId,
    warehouse_to: 'WH-03' as WarehouseId,
    notes: '',
    client_name: '',
    client_contact: '',
    client_address: '',
    channel: 'B2B Бар',
    packaging_type: 'tub_210',
    sku_finished: '',
  });

  const updateForm = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleCreate = async () => {
    if (!type) return;
    setLoading(true);
    try {
      const { id, number } = await createAct({
        type,
        date: Date.now(),
        supplier: form.supplier || undefined,
        invoice_number: form.invoice_number || undefined,
        warehouse_from: type === 'transfer' ? form.warehouse_from : undefined,
        warehouse_to:
          type === 'transfer'
            ? form.warehouse_to
            : type === 'receipt'
              ? 'WH-01'
              : type === 'packaging_card'
                ? 'WH-03'
                : undefined,
        client_name: form.client_name || undefined,
        client_contact: form.client_contact || undefined,
        client_address: form.client_address || undefined,
        channel: form.channel || undefined,
        packaging_type: type === 'packaging_card' ? form.packaging_type : undefined,
        sku_finished: form.sku_finished || undefined,
        responsible_user: currentUser?.id,
        checked_by: currentUser?.id,
        notes: form.notes || undefined,
      });
      setPreviewNumber(number);
      router.replace(`/(tabs)/acts/${id}`);
    } catch (e) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось создать акт');
    } finally {
      setLoading(false);
    }
  };

  const typeLabel = type ? ACT_TYPE_LABELS[type].split('(')[0].trim() : '';

  if (prefill_sku && loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Text className="text-[#555]">Создание акта для {prefill_sku}…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      {/* Topbar — ref: srecha_wms_new_act.html */}
      <View className="px-5 pt-2 pb-3 flex-row items-center gap-3">
        <Pressable
          onPress={() => (step > 1 ? setStep(step - 1) : router.back())}
          className="w-[34px] h-[34px] rounded-[10px] bg-surface border border-border items-center justify-center"
        >
          <Text className="text-[#888] text-lg">‹</Text>
        </Pressable>
        <View>
          <Text className="text-[17px] text-foreground font-medium">Новый акт</Text>
          <Text className="text-[11px] text-[#555]">
            {type ? `${typeLabel} · ${previewNumber}` : 'Выберите тип документа'}
          </Text>
        </View>
      </View>

      {step > 1 && (
        <View className="bg-content px-5 pt-3">
          <StepIndicator current={step} />
        </View>
      )}

      <ScrollView className="flex-1 bg-content px-5">
        {step === 1 && (
          <>
            <Text className="text-[11px] text-[#555] uppercase tracking-widest mb-2">Тип документа</Text>
            <View className="flex-row flex-wrap gap-2 mb-6">
              {TYPE_OPTIONS.map((opt) => {
                const selected = type === opt.type;
                return (
                  <Pressable
                    key={opt.type}
                    onPress={() => setType(opt.type)}
                    className={`w-[48%] bg-surface rounded-xl p-3 border flex-row gap-2.5 ${
                      selected ? 'border-gold bg-gold/5' : 'border-border'
                    }`}
                  >
                    <Text className="text-[22px]">{opt.emoji}</Text>
                    <View className="flex-1">
                      <Text className={`text-[13px] font-medium ${selected ? 'text-gold' : 'text-foreground'}`}>
                        {opt.name}
                      </Text>
                      <Text className="text-[10px] text-[#555] mt-0.5 leading-4">{opt.desc}</Text>
                      {selected && (
                        <View className="mt-1 self-start bg-gold/10 border border-gold/25 rounded px-1.5 py-0.5">
                          <Text className="text-[10px] text-gold">Выбрано</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {step === 2 && type && (
          <>
            {type === 'receipt' && (
              <View className="gap-2.5 mb-4">
                <FieldBox label="Поставщик" value={form.supplier} onChange={(v) => updateForm('supplier', v)} />
                <FieldBox label="Номер инвойса" value={form.invoice_number} onChange={(v) => updateForm('invoice_number', v)} />
              </View>
            )}

            {type === 'transfer' && (
              <>
                <Text className="text-[11px] text-[#555] uppercase tracking-widest mb-2">Маршрут передачи</Text>
                <View className="bg-surface rounded-[10px] border border-border p-3 flex-row items-center gap-2 mb-4">
                  <WhTag
                    label={form.warehouse_from}
                    onPress={() => {}}
                  />
                  <Text className="text-[#555]">→</Text>
                  <WhTag label={form.warehouse_to} />
                </View>
                <Text className="text-[11px] text-[#555] mb-2">Отправитель</Text>
                <View className="flex-row flex-wrap gap-2 mb-3">
                  {(Object.keys(WAREHOUSES) as WarehouseId[]).map((wh) => (
                    <WhTag
                      key={wh}
                      label={wh}
                      active={form.warehouse_from === wh}
                      onPress={() => updateForm('warehouse_from', wh)}
                    />
                  ))}
                </View>
                <Text className="text-[11px] text-[#555] mb-2">Получатель</Text>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {(TRANSFER_ROUTES[form.warehouse_from] ?? []).map((wh) => (
                    <WhTag
                      key={wh}
                      label={wh}
                      active={form.warehouse_to === wh}
                      onPress={() => updateForm('warehouse_to', wh)}
                    />
                  ))}
                </View>
              </>
            )}

            {type === 'packaging_card' && (
              <View className="mb-4">
                <Text className="text-[11px] text-[#555] uppercase tracking-widest mb-2">Тип упаковки</Text>
                {PACKAGING_TYPE_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.id}
                    onPress={() => updateForm('packaging_type', opt.id)}
                    className={`mb-2 p-3 rounded-[10px] border ${
                      form.packaging_type === opt.id ? 'border-gold bg-gold/5' : 'border-border bg-surface'
                    }`}
                  >
                    <Text className={form.packaging_type === opt.id ? 'text-gold' : 'text-foreground'}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
                <FieldBox label="SKU готовой продукции" value={form.sku_finished} onChange={(v) => updateForm('sku_finished', v)} />
              </View>
            )}

            {type === 'shipment_b2b' && (
              <View className="gap-2.5 mb-4">
                <FieldBox label="Клиент" value={form.client_name} onChange={(v) => updateForm('client_name', v)} />
                <FieldBox label="Контакт" value={form.client_contact} onChange={(v) => updateForm('client_contact', v)} />
                <FieldBox label="Адрес доставки" value={form.client_address} onChange={(v) => updateForm('client_address', v)} />
                <FieldBox label="Инвойс клиенту" value={form.invoice_number} onChange={(v) => updateForm('invoice_number', v)} />
              </View>
            )}

            <FieldBox label="Примечание" value={form.notes} onChange={(v) => updateForm('notes', v)} />
          </>
        )}
        <View className="h-24" />
      </ScrollView>

      {/* Bottom actions */}
      <View className="px-5 py-3 bg-background border-t border-[#1f1f1f] flex-row gap-2.5">
        {step === 1 ? (
          <>
            <Pressable
              onPress={() => router.back()}
              className="flex-1 bg-surface border border-border rounded-xl py-3.5 items-center"
            >
              <Text className="text-[#888] text-sm">Отмена</Text>
            </Pressable>
            <Pressable
              onPress={() => type && setStep(2)}
              disabled={!type}
              className={`flex-[2] rounded-xl py-3.5 items-center ${type ? 'bg-gold' : 'bg-gold/40'}`}
            >
              <Text className="text-background text-sm font-medium">Далее →</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              onPress={() => setStep(1)}
              className="flex-1 bg-surface border border-border rounded-xl py-3.5 items-center"
            >
              <Text className="text-[#888] text-sm">Назад</Text>
            </Pressable>
            <Pressable
              onPress={handleCreate}
              disabled={loading}
              className="flex-[2] bg-gold rounded-xl py-3.5 items-center"
            >
              <Text className="text-background text-sm font-medium">
                {loading ? 'Создание…' : 'Создать черновик →'}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function FieldBox({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View className="bg-surface rounded-[10px] border border-border px-3.5 py-2.5">
      <Text className="text-[10px] text-[#555] uppercase tracking-wide mb-1">{label}</Text>
      <TextInput
        className="text-sm text-foreground p-0"
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#444"
      />
    </View>
  );
}

function WhTag({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-md px-2 py-1 border ${
        active ? 'bg-gold/10 border-gold/30' : 'bg-surface border-border'
      }`}
    >
      <Text className={`text-xs font-medium ${active ? 'text-gold' : 'text-gold/70'}`}>{label}</Text>
    </Pressable>
  );
}
