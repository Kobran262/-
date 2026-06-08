import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { getProductByBarcode, bindBarcode, getActs } from '@/src/db/queries';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { ACT_TYPE_LABELS } from '@/src/types';
import type { ActType } from '@/src/types';
import type { products } from '@/src/db/schema';

type Product = typeof products.$inferSelect;
type DraftAct = Awaited<ReturnType<typeof getActs>>[number];

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const [bindSku, setBindSku] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [showDraftPicker, setShowDraftPicker] = useState(false);
  const [drafts, setDrafts] = useState<DraftAct[]>([]);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission]);

  const handleBarcode = async (data: string) => {
    if (scanned) return;
    setScanned(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const found = await getProductByBarcode(data);
    if (found) {
      setProduct(found);
      setUnknownBarcode(null);
    } else {
      setProduct(null);
      setUnknownBarcode(data);
    }
  };

  const handleManualSearch = async () => {
    if (!manualBarcode.trim()) return;
    setScanned(true);
    await handleBarcode(manualBarcode.trim());
  };

  const handleBind = async () => {
    if (!unknownBarcode || !bindSku.trim()) return;
    await bindBarcode(bindSku.trim(), unknownBarcode);
    Alert.alert('Готово', `Штрихкод привязан к ${bindSku}`);
    resetScanner();
  };

  const resetScanner = () => {
    setScanned(false);
    setProduct(null);
    setUnknownBarcode(null);
    setBindSku('');
    setManualBarcode('');
  };

  const openDraftPicker = async () => {
    if (!product) return;
    const list = await getActs({ status: 'draft' });
    setDrafts(list);
    setShowDraftPicker(true);
  };

  const pickDraft = (draftId: string) => {
    if (!product) return;
    setShowDraftPicker(false);
    router.push({
      pathname: '/(tabs)/acts/new',
      params: { prefill_sku: product.id, prefill_act_id: draftId },
    });
  };

  const pickNewAct = () => {
    if (!product) return;
    setShowDraftPicker(false);
    router.push({
      pathname: '/(tabs)/acts/new',
      params: { prefill_sku: product.id },
    });
  };

  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Text className="text-foreground">Запрос доступа к камере...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-foreground text-center mb-4">
          Нужен доступ к камере для сканирования штрихкодов
        </Text>
        <Button title="Разрешить камеру" onPress={requestPermission} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-4 pt-4 pb-2 flex-row justify-between items-center">
        <Text className="text-foreground text-2xl font-bold">Сканер</Text>
        <Button
          title="Ввод"
          variant="ghost"
          className="px-3 py-1 min-h-0"
          onPress={() => setShowManual(!showManual)}
        />
      </View>

      {!showManual ? (
        <View className="flex-1 mx-4 rounded-2xl overflow-hidden mb-4">
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'qr', 'datamatrix'],
            }}
            onBarcodeScanned={scanned ? undefined : ({ data }) => handleBarcode(data)}
          />
          <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
            <View className="w-64 h-40 border-2 border-gold rounded-xl" />
          </View>
        </View>
      ) : (
        <View className="px-4 mb-4">
          <Input
            label="Штрихкод"
            value={manualBarcode}
            onChangeText={setManualBarcode}
            keyboardType="number-pad"
          />
          <Button title="Найти" onPress={handleManualSearch} />
        </View>
      )}

      <View className="px-4 pb-6">
        {product && (
          <Card>
            <Text className="text-gold font-mono">{product.id}</Text>
            <Text className="text-foreground text-lg font-medium">{product.name}</Text>
            <Text className="text-foreground/60">
              {product.category} · {product.channel}
            </Text>
            <Text className="text-foreground/60">Склад: {product.warehouse}</Text>
            <Button title="Добавить в акт" className="mt-3" onPress={openDraftPicker} />
            <Button title="Сканировать снова" variant="secondary" className="mt-2" onPress={resetScanner} />
          </Card>
        )}

        {unknownBarcode && (
          <Card>
            <Text className="text-danger mb-2">Товар не найден</Text>
            <Text className="text-foreground/60 mb-3">Штрихкод: {unknownBarcode}</Text>
            <Input
              label="Привязать к SKU"
              value={bindSku}
              onChangeText={setBindSku}
              placeholder="GF-W-BMD210"
            />
            <View className="flex-row gap-2 mt-2">
              <Button title="Привязать" className="flex-1" onPress={handleBind} />
              <Button title="Отмена" variant="secondary" className="flex-1" onPress={resetScanner} />
            </View>
          </Card>
        )}

        {!product && !unknownBarcode && (
          <Text className="text-foreground/40 text-center">Наведите камеру на штрихкод</Text>
        )}
      </View>

      <Modal visible={showDraftPicker} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-background rounded-t-2xl max-h-[70%]">
            <View className="px-5 py-4 border-b border-border flex-row justify-between items-center">
              <Text className="text-foreground text-lg font-medium">Выберите акт</Text>
              <Pressable onPress={() => setShowDraftPicker(false)}>
                <Text className="text-gold">Отмена</Text>
              </Pressable>
            </View>
            <ScrollView className="px-5 py-3">
              <Pressable
                onPress={pickNewAct}
                className="bg-gold/10 border border-gold/25 rounded-xl p-4 mb-3"
              >
                <Text className="text-gold font-medium">+ Новый акт</Text>
                <Text className="text-[#888] text-xs mt-1">Создать черновик с выбранным товаром</Text>
              </Pressable>
              {drafts.length === 0 ? (
                <Text className="text-[#555] text-center py-4">Нет открытых черновиков</Text>
              ) : (
                drafts.map((d) => (
                  <Pressable
                    key={d.id}
                    onPress={() => pickDraft(d.id)}
                    className="bg-surface border border-border rounded-xl p-4 mb-2"
                  >
                    <Text className="text-gold font-mono">{d.number}</Text>
                    <Text className="text-foreground text-sm">
                      {ACT_TYPE_LABELS[d.type as ActType]}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
