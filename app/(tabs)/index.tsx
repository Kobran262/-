import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import Svg, { Path } from 'react-native-svg';
import Animated from 'react-native-reanimated';
import { useAuthStore } from '@/src/store/authStore';
import { useSyncStore } from '@/src/store/syncStore';
import { getActStats, getRecentActsWithDetails, createAct, addActLine } from '@/src/db/queries';
import { Avatar } from '@/src/components/ui/Avatar';
import { SyncBadge } from '@/src/components/ui/SyncBadge';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { VoiceInput, MicIcon } from '@/src/components/ui/VoiceInput';
import { ACT_TYPE_ICONS, ACT_TYPE_ICON_BG, getActMeta } from '@/src/utils/actDisplay';
import { WAREHOUSES } from '@/src/types';
import type { ActStatus } from '@/src/types';
import type { VoiceCommand } from '@/src/services/voice/parser';
import { isWhisperModelAvailable, subscribeModelProgress } from '@/src/services/voice/model';

const WH_SHORT = [
  { id: 'WH-01', label: 'Приём' },
  { id: 'WH-02', label: 'Упак.' },
  { id: 'WH-03', label: 'Произв.' },
  { id: 'WH-04', label: 'Отгруз.' },
];

export default function DashboardScreen() {
  const router = useRouter();
  const { currentUser } = useAuthStore();
  const { lastSyncAt, isSyncing } = useSyncStore();
  const [stats, setStats] = useState({ open: 0, drafts: 0, today: 0, closedToday: 0 });
  const [recent, setRecent] = useState<Awaited<ReturnType<typeof getRecentActsWithDetails>>>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);

  useEffect(() => {
    isWhisperModelAvailable().then(setModelReady);
    const unsub = subscribeModelProgress(({ percent }) => {
      setModelProgress(percent);
      if (percent >= 100) setModelReady(true);
    });
    return unsub;
  }, []);

  const load = useCallback(async () => {
    setStats(await getActStats());
    setRecent(await getRecentActsWithDetails(5));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleVoiceCommand = async (cmd: VoiceCommand) => {
    if (cmd.type === 'unknown' || !cmd.sku) {
      Alert.alert('Не понял команду', cmd.suggestion ?? 'Попробуйте ещё раз');
      return;
    }

    const actTypeMap = {
      shipment: 'shipment_b2b' as const,
      receipt: 'receipt' as const,
      transfer: 'transfer' as const,
    };

    const actType = actTypeMap[cmd.type];
    if (!actType) {
      Alert.alert('Не понял команду', cmd.suggestion ?? 'Попробуйте ещё раз');
      return;
    }

    const { id } = await createAct({
      type: actType,
      date: cmd.date ?? Date.now(),
      responsible_user: currentUser?.id,
      notes: `Голос: «${cmd.raw}»`,
      warehouse_to: actType === 'receipt' ? 'WH-01' : actType === 'transfer' ? 'WH-03' : undefined,
      warehouse_from: actType === 'transfer' ? 'WH-01' : undefined,
    });

    if (cmd.sku && cmd.qty) {
      await addActLine(
        id,
        {
          sku: cmd.sku,
          product_name: cmd.productName ?? cmd.sku,
          unit: cmd.unit ?? 'шт',
          qty_planned: cmd.qty,
          qty_actual: cmd.qty,
        },
        1
      );
    }

    router.push(`/(tabs)/acts/${id}`);
  };

  const warehouseLabel = currentUser?.warehouse_default
    ? WAREHOUSES[currentUser.warehouse_default as keyof typeof WAREHOUSES]?.split(' ').slice(-1)[0]
    : '';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C8A96E" />}
      >
        {/* Header — ref: srecha_wms_dashboard.html */}
        <View className="px-5 pt-2 pb-4">
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center gap-2.5">
              <Avatar name={currentUser?.name ?? '?'} />
              <View>
                <Text className="text-foreground text-sm font-medium">{currentUser?.name}</Text>
                <Text className="text-[#888] text-[11px]">
                  {currentUser?.warehouse_default} · {warehouseLabel}
                </Text>
              </View>
            </View>
            <SyncBadge synced={!isSyncing && !!lastSyncAt} label={isSyncing ? 'Sync…' : 'Sync'} />
          </View>
          <View className="mt-3">
            <Text className="text-[22px] text-foreground font-medium">
              Добрый день <Text className="text-gold">☕</Text>
            </Text>
            <Text className="text-[#666] text-xs mt-0.5">
              {format(new Date(), 'EEEE, d MMMM yyyy', { locale: ru })}
            </Text>
          </View>
        </View>

        {/* Content panel */}
        <View className="bg-content px-5 pt-4 pb-6">
          <View className="flex-row flex-wrap gap-2.5 mb-4">
            <View className="w-[47%] bg-surface rounded-[14px] p-3.5 border border-border">
              <Text className="text-[11px] text-[#666] uppercase tracking-wide mb-1.5">Открытых актов</Text>
              <Text className="text-[28px] text-gold font-medium">{stats.open}</Text>
              {stats.today > 0 && (
                <Text className="text-[11px] text-gold mt-1">↑ {stats.today} сегодня</Text>
              )}
            </View>
            <View className="w-[47%] bg-surface rounded-[14px] p-3.5 border border-border">
              <Text className="text-[11px] text-[#666] uppercase tracking-wide mb-1.5">Закрыто сегодня</Text>
              <Text className="text-[28px] text-success font-medium">{stats.closedToday}</Text>
              <Text className="text-[11px] text-success mt-1">всё ok</Text>
            </View>
            <View className="w-full bg-surface rounded-[14px] p-3.5 border border-border flex-row justify-between items-center">
              <View>
                <Text className="text-[11px] text-[#666] uppercase tracking-wide">Склады онлайн</Text>
                <Text className="text-[13px] text-foreground mt-1">4 из 4 активны</Text>
              </View>
              <View className="flex-row gap-1.5">
                {WH_SHORT.map((wh) => (
                  <View key={wh.id} className="items-center gap-0.5">
                    <View className="w-9 h-9 rounded-full bg-gold/10 border border-gold/30 items-center justify-center">
                      <Text className="text-[9px] text-gold font-medium">{wh.id.replace('WH-', '')}</Text>
                    </View>
                    <Text className="text-[9px] text-[#555]">{wh.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <Text className="text-[12px] text-[#555] uppercase tracking-widest mb-2.5">Быстрые действия</Text>
          <View className="flex-row gap-2 mb-4">
            <Pressable
              onPress={() => router.push('/(tabs)/acts/new')}
              className="flex-1 bg-surface border border-border rounded-xl py-3 items-center gap-1.5"
            >
              <View className="w-[38px] h-[38px] rounded-[10px] bg-gold/20 items-center justify-center">
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 5v14M5 12h14"
                    stroke="#C8A96E"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </Svg>
              </View>
              <Text className="text-[10px] text-[#888]">Новый акт</Text>
            </Pressable>

            <VoiceInput
              onCommand={handleVoiceCommand}
              disabled={!modelReady}
              renderTrigger={(onPress, voiceState, animatedStyle) => (
                <Pressable
                  onPress={modelReady ? onPress : undefined}
                  disabled={!modelReady && voiceState === 'idle'}
                  className={`flex-1 rounded-xl py-3 items-center gap-1.5 ${
                    voiceState !== 'idle' ? 'border border-gold/60' : 'border border-gold/30'
                  }`}
                  style={{ backgroundColor: voiceState !== 'idle' ? '#C8A96E22' : '#C8A96E08' }}
                >
                  <Animated.View
                    className="w-[38px] h-[38px] rounded-[10px] items-center justify-center"
                    style={[
                      { backgroundColor: '#C8A96E18', borderWidth: 1, borderColor: '#C8A96E33' },
                      animatedStyle,
                    ]}
                  >
                    {!modelReady ? (
                      <ActivityIndicator size="small" color="#C8A96E66" />
                    ) : voiceState === 'transcribing' ? (
                      <ActivityIndicator size="small" color="#C8A96E" />
                    ) : (
                      <MicIcon
                        size={20}
                        color={voiceState !== 'idle' ? '#C8A96E' : '#C8A96ECC'}
                      />
                    )}
                  </Animated.View>
                  <Text className="text-[10px]" style={{ color: modelReady ? '#C8A96E' : '#C8A96E66' }}>
                    {!modelReady
                      ? modelProgress > 0
                        ? `${modelProgress}%`
                        : 'Загрузка…'
                      : voiceState === 'recording'
                        ? 'Слушаю…'
                        : voiceState === 'transcribing'
                          ? 'Отмена ✕'
                          : 'Голос'}
                  </Text>
                </Pressable>
              )}
            />

            <Pressable
              onPress={() => router.push('/(tabs)/inventory')}
              className="flex-1 bg-surface border border-border rounded-xl py-3 items-center gap-1.5"
            >
              <View className="w-[38px] h-[38px] rounded-[10px] bg-success/10 items-center justify-center">
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M9 11l3 3L22 4"
                    stroke="#5BA85F"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Path
                    d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
                    stroke="#5BA85F"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <Text className="text-[10px] text-[#888]">Инвентаризация</Text>
            </Pressable>
          </View>

          <Text className="text-[12px] text-[#555] uppercase tracking-widest mb-2.5">Последние акты</Text>
          {recent.length === 0 ? (
            <View className="bg-surface rounded-xl p-4 border border-border">
              <Text className="text-[#555] text-center text-sm">Нет актов</Text>
            </View>
          ) : (
            recent.map((act) => (
              <Pressable
                key={act.id}
                onPress={() => router.push(`/(tabs)/acts/${act.id}`)}
                className="bg-surface rounded-xl p-3 border border-border mb-2 flex-row items-center gap-3"
              >
                <View
                  className={`w-9 h-9 rounded-[9px] items-center justify-center ${ACT_TYPE_ICON_BG[act.type] ?? 'bg-gold/10'}`}
                >
                  <Text className="text-[15px]">{ACT_TYPE_ICONS[act.type] ?? '📄'}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[13px] text-foreground font-medium">{act.number}</Text>
                  <Text className="text-[11px] text-[#555] mt-0.5">{getActMeta(act)}</Text>
                </View>
                <StatusBadge status={act.status as ActStatus} />
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
