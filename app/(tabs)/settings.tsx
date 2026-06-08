import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useAuthStore } from '@/src/store/authStore';
import { useSyncStore } from '@/src/store/syncStore';
import { useSettingsStore } from '@/src/store/settingsStore';
import { getProductCount } from '@/src/db/queries';
import { exportProductsCsv, exportMovementsCsv, shareCsv } from '@/src/services/csv/exporter';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { WAREHOUSES } from '@/src/types';
import Constants from 'expo-constants';

export default function SettingsScreen() {
  const { currentUser, logout, biometricEnabled } = useAuthStore();
  const { lastSyncAt, isSyncing, sync } = useSyncStore();
  const { gdriveAutoUpload, setGdriveAutoUpload } = useSettingsStore();
  const [skuCount, setSkuCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getProductCount().then(setSkuCount);
  }, []);

  const handleExportProducts = async () => {
    setLoading(true);
    try {
      const path = await exportProductsCsv();
      await shareCsv(path);
    } catch (e) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Экспорт не удался');
    } finally {
      setLoading(false);
    }
  };

  const handleExportMovements = async () => {
    setLoading(true);
    try {
      const path = await exportMovementsCsv();
      await shareCsv(path);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (currentUser) await sync(currentUser.id);
  };

  const handleLogout = () => {
    Alert.alert('Выход', 'Выйти из приложения?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4 pt-4">
        <Text className="text-foreground text-2xl font-bold mb-6">Настройки</Text>

        <Text className="text-gold text-sm mb-2 uppercase tracking-wider">Профиль</Text>
        <Card className="mb-4">
          <Text className="text-foreground font-medium">{currentUser?.name}</Text>
          <Text className="text-foreground/60">{currentUser?.role} · {currentUser?.warehouse_default}</Text>
          <Text className="text-foreground/40 text-sm mt-1">
            Биометрия: {biometricEnabled ? 'включена' : 'выключена'}
          </Text>
          <Button title="Выйти" variant="danger" className="mt-3" onPress={handleLogout} />
        </Card>

        <Text className="text-gold text-sm mb-2 uppercase tracking-wider">Синхронизация</Text>
        <Card className="mb-4">
          <Text className="text-foreground/60 text-sm">
            Последняя sync: {lastSyncAt ? format(new Date(lastSyncAt), 'dd.MM.yyyy HH:mm') : '—'}
          </Text>
          <Button title={isSyncing ? 'Синхронизация…' : 'Принудительная sync'} variant="secondary" className="mt-3" onPress={handleSync} disabled={isSyncing} />
          <Button title="Экспорт товаров CSV" variant="ghost" className="mt-2" onPress={handleExportProducts} loading={loading} />
          <Button title="Экспорт движений CSV" variant="ghost" className="mt-2" onPress={handleExportMovements} />
        </Card>

        <Text className="text-gold text-sm mb-2 uppercase tracking-wider">Google Drive</Text>
        <Card className="mb-4">
          <Text className="text-foreground/60 text-sm mb-2">Автовыгрузка PDF при закрытии акта</Text>
          <View className="flex-row gap-2">
            <Button title="Вкл" variant={gdriveAutoUpload ? 'primary' : 'secondary'} className="flex-1" onPress={() => setGdriveAutoUpload(true)} />
            <Button title="Выкл" variant={!gdriveAutoUpload ? 'primary' : 'secondary'} className="flex-1" onPress={() => setGdriveAutoUpload(false)} />
          </View>
          <Text className="text-foreground/40 text-xs mt-2">OAuth подключение — в следующей итерации</Text>
        </Card>

        <Text className="text-gold text-sm mb-2 uppercase tracking-wider">База товаров</Text>
        <Card className="mb-4">
          <Text className="text-foreground">SKU в базе: {skuCount}</Text>
        </Card>

        <Text className="text-gold text-sm mb-2 uppercase tracking-wider">Склады</Text>
        <Card className="mb-4">
          {(Object.entries(WAREHOUSES) as [string, string][]).map(([id, name]) => (
            <Text key={id} className="text-foreground/70 py-1">{id}: {name}</Text>
          ))}
        </Card>

        <Text className="text-gold text-sm mb-2 uppercase tracking-wider">О приложении</Text>
        <Card className="mb-8">
          <Text className="text-foreground">Srecha WMS v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
          <Text className="text-foreground/40 text-sm">DOO «Srecha» · Сербия</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
