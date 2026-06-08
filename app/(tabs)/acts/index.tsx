import { useCallback, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { getActs, deleteDraftAct } from '@/src/db/queries';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { ACT_TYPE_LABELS } from '@/src/types';
import type { ActStatus, ActType } from '@/src/types';
import { Alert } from 'react-native';

type ActRow = Awaited<ReturnType<typeof getActs>>[number];

export default function ActsListScreen() {
  const router = useRouter();
  const [acts, setActs] = useState<ActRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ActStatus | 'all'>('all');

  const load = useCallback(async () => {
    const data = await getActs({
      search: search || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
    });
    setActs(data);
  }, [search, statusFilter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = (act: ActRow) => {
    if (act.status !== 'draft') return;
    Alert.alert('Удалить черновик?', act.number, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await deleteDraftAct(act.id);
          load();
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-4 pt-4 pb-2 flex-row justify-between items-center">
        <Text className="text-foreground text-2xl font-bold">Акты</Text>
        <Button title="+ Новый" onPress={() => router.push('/(tabs)/acts/new')} className="px-4 py-2 min-h-0" />
      </View>

      <View className="px-4 mb-2">
        <TextInput
          className="bg-card border border-white/10 rounded-xl px-4 py-2 text-foreground"
          placeholder="Поиск по номеру..."
          placeholderTextColor="#666"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={load}
        />
      </View>

      <View className="flex-row px-4 gap-2 mb-3">
        {(['all', 'draft', 'active', 'closed'] as const).map((s) => (
          <Pressable
            key={s}
            onPress={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full ${statusFilter === s ? 'bg-gold' : 'bg-card'}`}
          >
            <Text className={statusFilter === s ? 'text-background text-xs' : 'text-foreground/60 text-xs'}>
              {s === 'all' ? 'Все' : s === 'draft' ? 'Черновики' : s === 'active' ? 'Активные' : 'Закрытые'}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlashList
        data={acts}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/(tabs)/acts/${item.id}`)} onLongPress={() => handleDelete(item)}>
            <Card className="mb-2">
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  <Text className="text-gold font-mono">{item.number}</Text>
                  <Text className="text-foreground">{ACT_TYPE_LABELS[item.type as ActType]}</Text>
                  <Text className="text-foreground/40 text-xs mt-1">
                    {format(new Date(item.date), 'dd MMM yyyy', { locale: ru })}
                  </Text>
                </View>
                <StatusBadge status={item.status as ActStatus} />
              </View>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={<Text className="text-foreground/50 text-center mt-8">Акты не найдены</Text>}
      />
    </SafeAreaView>
  );
}
