import { create } from 'zustand';
import { eq } from 'drizzle-orm';
import { getDb } from '@/src/db/client';
import { settings } from '@/src/db/schema';
import { syncOnStartup } from '@/src/firebase/sync';

interface SyncState {
  lastSyncAt: number | null;
  isSyncing: boolean;
  syncError: string | null;
  init: () => Promise<void>;
  sync: (userId?: string) => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  lastSyncAt: null,
  isSyncing: false,
  syncError: null,

  init: async () => {
    const db = getDb();
    const rows = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'last_sync_at'))
      .limit(1);
    if (rows.length > 0) {
      set({ lastSyncAt: parseInt(rows[0].value, 10) });
    }
  },

  sync: async (userId) => {
    set({ isSyncing: true, syncError: null });
    try {
      const result = await syncOnStartup(userId ?? 'local');
      const now = Date.now();
      const db = getDb();
      await db
        .insert(settings)
        .values({ key: 'last_sync_at', value: String(now) })
        .onConflictDoUpdate({ target: settings.key, set: { value: String(now) } });
      set({ lastSyncAt: now, isSyncing: false });
      if (!result.success && result.error) {
        set({ syncError: result.error });
      }
    } catch (e) {
      set({
        isSyncing: false,
        syncError: e instanceof Error ? e.message : 'Ошибка синхронизации',
      });
    }
  },
}));
