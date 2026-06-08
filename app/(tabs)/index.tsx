import { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAuthStore } from '@/src/store/authStore';
import { useSyncStore } from '@/src/store/syncStore';
import { getActStats, getRecentActsWithDetails } from '@/src/db/queries';
import { Avatar } from '@/src/components/ui/Avatar';
import { SyncBadge } from '@/src/components/ui/SyncBadge';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { ACT_TYPE_ICONS, ACT_TYPE_ICON_BG, getActMeta } from '@/src/utils/actDisplay';
import { WAREHOUSES } from '@/src/types';
import type { ActStatus } from '@/src/types';

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
            {[
              { label: 'Новый акт', icon: '＋', bg: 'bg-gold/10', color: 'text-gold', route: '/(tabs)/acts/new' as const },
              { label: 'Сканировать', icon: '⬡', bg: 'bg-accent-blue/10', color: 'text-accent-blue', route: '/(tabs)/scanner' as const },
              { label: 'Инвентаризация', icon: '≡', bg: 'bg-success/10', color: 'text-success', route: '/(tabs)/inventory' as const },
            ].map((action) => (
              <Pressable
                key={action.label}
                onPress={() => router.push(action.route)}
                className="flex-1 bg-surface rounded-xl p-3 border border-border items-center gap-2"
              >
                <View className={`w-[38px] h-[38px] rounded-[10px] ${action.bg} items-center justify-center`}>
                  <Text className={`text-lg ${action.color}`}>{action.icon}</Text>
                </View>
                <Text className="text-[11px] text-[#888] text-center">{action.label}</Text>
              </Pressable>
            ))}
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
