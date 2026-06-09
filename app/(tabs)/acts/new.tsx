import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  type KeyboardTypeOptions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { createAct, addActLine, getProductBySku, getActLines } from '@/src/db/queries';
import { StepIndicator } from '@/src/components/ui/StepIndicator';
import { BackArrow } from '@/src/components/ui/BackArrow';
import { ACT_TYPE_LABELS, TRANSFER_ROUTES, WAREHOUSES } from '@/src/types';
import type { ActType, WarehouseId } from '@/src/types';
import { useAuthStore } from '@/src/store/authStore';
import { PACKAGING_TYPE_OPTIONS } from '@/src/utils/bom';
import { TYPE_OPTIONS } from '@/src/utils/actDisplay';
import {
  receiptActSchema,
  transferActSchema,
  packagingActSchema,
  shipmentActSchema,
} from '@/src/utils/validation';

export default function NewActScreen() {
  const router = useRouter();
  const { prefill_sku, prefill_act_id } = useLocalSearchParams<{
    prefill_sku?: string;
    prefill_act_id?: string;
  }>();
  const { currentUser } = useAuthStore();
  const [step, setStep] = useState(1);
  const [type, setType] = useState<ActType | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewNumber, setPreviewNumber] = useState('новый');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showTypeError, setShowTypeError] = useState(false);
  const prefillDone = useRef(false);

  useEffect(() => {
    if (!prefill_act_id || !prefill_sku || prefillDone.current) return;
    prefillDone.current = true;

    (async () => {
      const product = await getProductBySku(prefill_sku);
      if (!product) {
        Alert.alert('Ошибка', `Товар ${prefill_sku} не найден`);
        prefillDone.current = false;
        return;
      }

      setLoading(true);
      try {
        const existingLines = await getActLines(prefill_act_id);
        await addActLine(
          prefill_act_id,
          {
            sku: product.id,
            product_name: product.name,
            category: product.category,
            unit: 'шт',
            qty_planned: 1,
            qty_actual: 1,
            price_unit: product.price_opt ?? product.price_rrp ?? 0,
          },
          existingLines.length + 1
        );
        router.replace(`/(tabs)/acts/${prefill_act_id}`);
      } catch (e) {
        Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось добавить позицию');
        prefillDone.current = false;
      } finally {
        setLoading(false);
      }
    })();
  }, [prefill_act_id, prefill_sku, router]);

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

  const validateStep2 = (): boolean => {
    if (!type) return false;
    const base = {
      date: Date.now(),
      responsible_user: currentUser?.id ?? '',
    };

    const schemaMap = {
      receipt: receiptActSchema,
      transfer: transferActSchema,
      packaging_card: packagingActSchema,
      shipment_b2b: shipmentActSchema,
      shipment_ecom: shipmentActSchema,
    } as const;

    const schema = schemaMap[type as keyof typeof schemaMap];
    if (!schema) return true;

    const result = schema.safeParse({ ...base, ...form });
    if (result.success) {
      setErrors({});
      return true;
    }

    const newErrors: Record<string, string> = {};
    result.error.issues.forEach((e) => {
      const field = String(e.path[0]);
      newErrors[field] = e.message;
    });
    setErrors(newErrors);
    return false;
  };

  const handleCreate = async () => {
    if (!validateStep2()) return;
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

      if (prefill_sku && !prefill_act_id) {
        const product = await getProductBySku(prefill_sku);
        if (product) {
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
        }
      }

      router.replace(`/(tabs)/acts/${id}`);
    } catch (e) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось создать акт');
    } finally {
      setLoading(false);
    }
  };

  const typeLabel = type ? ACT_TYPE_LABELS[type].split('(')[0].trim() : '';

  if (prefill_act_id && prefill_sku && loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Text className="text-[#555]">Добавление {prefill_sku} в акт…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
      {/* Topbar — ref: srecha_wms_new_act.html */}
      <View className="px-5 pt-2 pb-3 flex-row items-center gap-3">
        <Pressable
          onPress={() => (step > 1 ? setStep(step - 1) : router.back())}
          className="w-[34px] h-[34px] rounded-[10px] bg-surface border border-border items-center justify-center"
        >
          <BackArrow />
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

      <ScrollView
        className="flex-1 bg-content px-5"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && (
          <>
            {prefill_sku && !prefill_act_id && (
              <View className="bg-gold/10 border border-gold/25 rounded-xl p-3 mb-4">
                <Text className="text-gold text-sm font-medium">Товар: {prefill_sku}</Text>
                <Text className="text-[#888] text-xs mt-1">
                  Выберите тип акта — товар будет добавлен в первую строку после создания
                </Text>
              </View>
            )}
            <Text className="text-[11px] text-[#555] uppercase tracking-widest mb-2">Тип документа</Text>
            <View className="flex-row flex-wrap gap-2 mb-6">
              {TYPE_OPTIONS.map((opt) => {
                const selected = type === opt.type;
                return (
                  <Pressable
                    key={opt.type}
                    onPress={() => {
                      setType(opt.type);
                      setShowTypeError(false);
                    }}
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
            {showTypeError && (
              <Text className="text-danger text-xs text-center mt-2">
                Выберите тип документа
              </Text>
            )}
          </>
        )}

        {step === 2 && type && (
          <>
            {type === 'receipt' && (
              <View className="gap-2.5 mb-4">
                <FieldBox
                  label="Поставщик *"
                  value={form.supplier}
                  onChange={(v) => updateForm('supplier', v)}
                />
                {errors.supplier && (
                  <Text className="text-danger text-xs ml-1 -mt-1">{errors.supplier}</Text>
                )}
                <FieldBox
                  label="Номер инвойса *"
                  value={form.invoice_number}
                  onChange={(v) => updateForm('invoice_number', v)}
                />
                {errors.invoice_number && (
                  <Text className="text-danger text-xs ml-1 -mt-1">{errors.invoice_number}</Text>
                )}
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
                <FieldBox
                  label="SKU готовой продукции *"
                  value={form.sku_finished}
                  onChange={(v) => updateForm('sku_finished', v)}
                />
                {errors.sku_finished && (
                  <Text className="text-danger text-xs ml-1 -mt-1 mb-1">{errors.sku_finished}</Text>
                )}
              </View>
            )}

            {type === 'shipment_b2b' && (
              <View className="gap-2.5 mb-4">
                <FieldBox label="Клиент" value={form.client_name} onChange={(v) => updateForm('client_name', v)} />
                {errors.client_name && (
                  <Text className="text-danger text-xs ml-1 -mt-1 mb-1">{errors.client_name}</Text>
                )}
                <FieldBox label="Контакт" value={form.client_contact} onChange={(v) => updateForm('client_contact', v)} />
                <FieldBox label="Адрес доставки" value={form.client_address} onChange={(v) => updateForm('client_address', v)} />
                <FieldBox label="Инвойс клиенту" value={form.invoice_number} onChange={(v) => updateForm('invoice_number', v)} />
              </View>
            )}

            <FieldBox label="Примечание" value={form.notes} onChange={(v) => updateForm('notes', v)} multiline />
          </>
        )}
      </ScrollView>

      {/* Bottom actions */}
      <View className="px-5 py-3 bg-background border-t border-[#1f1f1f] flex-row gap-2.5">
        {step === 1 ? (
          <Pressable
            onPress={() => {
              if (!type) {
                setShowTypeError(true);
                return;
              }
              setShowTypeError(false);
              setStep(2);
            }}
            className="flex-1 bg-gold rounded-xl py-3.5 items-center"
          >
            <Text className="text-background text-sm font-medium">Далее →</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              onPress={() => setStep(1)}
              className="flex-1 bg-surface border border-border rounded-xl py-3.5 items-center"
            >
              <Text className="text-[#888] text-sm">← Назад</Text>
            </Pressable>
            <Pressable
              onPress={handleCreate}
              disabled={loading}
              className="flex-[2] bg-gold rounded-xl py-3.5 items-center"
            >
              <Text className="text-background text-sm font-medium">
                {loading ? 'Создание…' : 'Создать черновик'}
              </Text>
            </Pressable>
          </>
        )}
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldBox({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
}) {
  return (
    <View className="mb-2">
      <Text className="text-[10px] text-[#555] uppercase tracking-wide mb-1 ml-0.5">{label}</Text>
      <View className="bg-surface rounded-[10px] border border-border px-3.5">
        <TextInput
          className="text-sm text-foreground"
          style={{ minHeight: 44, textAlignVertical: multiline ? 'top' : 'center' }}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#444"
          keyboardType={keyboardType}
          multiline={multiline}
        />
      </View>
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
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      className={`rounded-lg px-3 py-2.5 border min-w-[70px] items-center ${
        active ? 'bg-gold/10 border-gold/40' : 'bg-surface border-border'
      }`}
    >
      <Text className={`text-sm font-medium ${active ? 'text-gold' : 'text-gold/70'}`}>{label}</Text>
    </Pressable>
  );
}
