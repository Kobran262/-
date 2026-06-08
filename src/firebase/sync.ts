import { collection, getDocs, query, where, doc, setDoc, Timestamp } from 'firebase/firestore';
import { eq } from 'drizzle-orm';
import { getDb } from '@/src/db/client';
import { acts, products, movements } from '@/src/db/schema';
import { getFirestoreDb, COMPANY_ID, isFirebaseConfigured } from './config';
import { getFullDeviceId } from '@/src/utils/deviceId';

export interface SyncResult {
  success: boolean;
  pulled: number;
  pushed: number;
  error?: string;
}

export async function syncOnStartup(userId: string): Promise<SyncResult> {
  const result: SyncResult = { success: true, pulled: 0, pushed: 0 };

  if (!isFirebaseConfigured()) {
    return result;
  }

  try {
    const firestore = getFirestoreDb();
    const localDb = getDb();
    const deviceId = await getFullDeviceId();

    const pendingActs = await localDb
      .select()
      .from(acts)
      .where(eq(acts.sync_pending, true));

    for (const act of pendingActs) {
      if (act.status === 'draft') continue;
      const ref = doc(firestore, `companies/${COMPANY_ID}/acts/${act.id}`);
      await setDoc(ref, { ...act, company_id: COMPANY_ID, is_deleted: false, updated_at: Timestamp.fromMillis(act.updated_at) }, { merge: true });
      await localDb.update(acts).set({ sync_pending: false }).where(eq(acts.id, act.id));
      result.pushed += 1;
    }

    const pendingProducts = await localDb
      .select()
      .from(products)
      .where(eq(products.sync_pending, true));

    for (const product of pendingProducts) {
      const ref = doc(firestore, `companies/${COMPANY_ID}/products/${product.id}`);
      await setDoc(ref, { ...product, company_id: COMPANY_ID, updated_at: Timestamp.fromMillis(product.updated_at) }, { merge: true });
      await localDb.update(products).set({ sync_pending: false }).where(eq(products.id, product.id));
      result.pushed += 1;
    }

    const pendingMovements = await localDb
      .select()
      .from(movements)
      .where(eq(movements.sync_pending, true));

    for (const mov of pendingMovements) {
      const ref = doc(firestore, `companies/${COMPANY_ID}/movements/${mov.id}`);
      await setDoc(ref, { ...mov, company_id: COMPANY_ID, device_id: deviceId, updated_at: Timestamp.fromMillis(mov.created_at) }, { merge: true });
      await localDb.update(movements).set({ sync_pending: false }).where(eq(movements.id, mov.id));
      result.pushed += 1;
    }

    try {
      const actsSnap = await getDocs(collection(firestore, `companies/${COMPANY_ID}/acts`));
      result.pulled += actsSnap.size;
    } catch {
      // Firebase may be unavailable offline — local-first
    }
  } catch (e) {
    result.success = false;
    result.error = e instanceof Error ? e.message : 'Sync failed';
  }

  return result;
}

export async function markActForSync(actId: string): Promise<void> {
  const localDb = getDb();
  await localDb
    .update(acts)
    .set({ sync_pending: true, updated_at: Date.now() })
    .where(eq(acts.id, actId));
}
