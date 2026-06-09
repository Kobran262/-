import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { eq } from 'drizzle-orm';
import { getDb } from '@/src/db/client';
import { users } from '@/src/db/schema';
import { hashPin, verifyPin } from '@/src/utils/validation';
import type { User } from '@/src/types';

const SESSION_KEY = 'srecha_session_user_id';
const BIOMETRIC_KEY = 'srecha_biometric_enabled';

interface AuthState {
  currentUser: User | null;
  isLoading: boolean;
  biometricEnabled: boolean;
  allUsers: User[];
  init: () => Promise<void>;
  loadUsers: () => Promise<void>;
  loginWithPin: (userId: string, pin: string) => Promise<boolean>;
  loginWithBiometric: () => Promise<boolean>;
  logout: () => Promise<void>;
  setBiometric: (enabled: boolean) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  isLoading: true,
  biometricEnabled: false,
  allUsers: [],

  init: async () => {
    const biometric = (await SecureStore.getItemAsync(BIOMETRIC_KEY)) === 'true';
    set({ biometricEnabled: biometric });
    await get().loadUsers();
    const sessionId = await SecureStore.getItemAsync(SESSION_KEY);
    if (sessionId) {
      const db = getDb();
      const rows = await db.select().from(users).where(eq(users.id, sessionId)).limit(1);
      if (rows.length > 0) {
        const u = rows[0];
        set({
          currentUser: {
            id: u.id,
            name: u.name,
            full_name: u.full_name ?? undefined,
            role: u.role as User['role'],
            warehouse_default: u.warehouse_default as User['warehouse_default'],
            created_at: u.created_at,
            updated_at: u.updated_at,
          },
        });
      }
    }
    set({ isLoading: false });
  },

  loadUsers: async () => {
    const db = getDb();
    const rows = await db.select().from(users);
    set({
      allUsers: rows.map((u) => ({
        id: u.id,
        name: u.name,
        full_name: u.full_name ?? undefined,
        role: u.role as User['role'],
        warehouse_default: u.warehouse_default as User['warehouse_default'],
        created_at: u.created_at,
        updated_at: u.updated_at,
      })),
    });
  },

  loginWithPin: async (userId, pin) => {
    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (rows.length === 0) return false;
    const user = rows[0];
    const { valid, needsRehash } = await verifyPin(pin, user.pin_hash);
    if (!valid) return false;
    if (needsRehash) {
      const newHash = await hashPin(pin);
      await db
        .update(users)
        .set({ pin_hash: newHash, updated_at: Date.now() })
        .where(eq(users.id, userId));
    }
    await SecureStore.setItemAsync(SESSION_KEY, userId);
    set({
      currentUser: {
        id: user.id,
        name: user.name,
        full_name: user.full_name ?? undefined,
        role: user.role as User['role'],
        warehouse_default: user.warehouse_default as User['warehouse_default'],
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
    return true;
  },

  loginWithBiometric: async () => {
    const sessionId = await SecureStore.getItemAsync(SESSION_KEY);
    if (!sessionId) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Вход в Srecha WMS',
      fallbackLabel: 'Использовать PIN',
    });
    if (!result.success) return false;
    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.id, sessionId)).limit(1);
    if (rows.length === 0) return false;
    const user = rows[0];
    set({
      currentUser: {
        id: user.id,
        name: user.name,
        full_name: user.full_name ?? undefined,
        role: user.role as User['role'],
        warehouse_default: user.warehouse_default as User['warehouse_default'],
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
    return true;
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    set({ currentUser: null });
  },

  setBiometric: async (enabled) => {
    await SecureStore.setItemAsync(BIOMETRIC_KEY, enabled ? 'true' : 'false');
    set({ biometricEnabled: enabled });
  },
}));
