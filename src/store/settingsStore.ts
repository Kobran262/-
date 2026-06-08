import { create } from 'zustand';
import { eq } from 'drizzle-orm';
import { getDb } from '@/src/db/client';
import { settings } from '@/src/db/schema';

interface SettingsState {
  gdriveAutoUpload: boolean;
  darkMode: boolean;
  init: () => Promise<void>;
  setGdriveAutoUpload: (value: boolean) => Promise<void>;
  setDarkMode: (value: boolean) => Promise<void>;
}

async function getSetting(key: string, defaultValue: string): Promise<string> {
  const db = getDb();
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return rows.length > 0 ? rows[0].value : defaultValue;
}

async function setSetting(key: string, value: string): Promise<void> {
  const db = getDb();
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export const useSettingsStore = create<SettingsState>((set) => ({
  gdriveAutoUpload: false,
  darkMode: true,

  init: async () => {
    const gdrive = await getSetting('gdrive_auto_upload', 'false');
    const dark = await getSetting('dark_mode', 'true');
    set({
      gdriveAutoUpload: gdrive === 'true',
      darkMode: dark === 'true',
    });
  },

  setGdriveAutoUpload: async (value) => {
    await setSetting('gdrive_auto_upload', value ? 'true' : 'false');
    set({ gdriveAutoUpload: value });
  },

  setDarkMode: async (value) => {
    await setSetting('dark_mode', value ? 'true' : 'false');
    set({ darkMode: value });
  },
}));
