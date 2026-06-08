import { collection, getDocs, doc, setDoc, Timestamp } from 'firebase/firestore';
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

function toMillis(ts: unknown): number {
  if (ts instanceof Timestamp) return ts.toMillis();
  if (typeof ts === 'number') return ts;
  return 0;
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
      await setDoc(
        ref,
        { ...act, company_id: COMPANY_ID, is_deleted: false, updated_at: Timestamp.fromMillis(act.updated_at) },
        { merge: true }
      );
      await localDb.update(acts).set({ sync_pending: false }).where(eq(acts.id, act.id));
      result.pushed += 1;
    }

    const pendingProducts = await localDb
      .select()
      .from(products)
      .where(eq(products.sync_pending, true));

    for (const product of pendingProducts) {
      const ref = doc(firestore, `companies/${COMPANY_ID}/products/${product.id}`);
      await setDoc(
        ref,
        { ...product, company_id: COMPANY_ID, updated_at: Timestamp.fromMillis(product.updated_at) },
        { merge: true }
      );
      await localDb.update(products).set({ sync_pending: false }).where(eq(products.id, product.id));
      result.pushed += 1;
    }

    const pendingMovements = await localDb
      .select()
      .from(movements)
      .where(eq(movements.sync_pending, true));

    for (const mov of pendingMovements) {
      const ref = doc(firestore, `companies/${COMPANY_ID}/movements/${mov.id}`);
      await setDoc(
        ref,
        { ...mov, company_id: COMPANY_ID, device_id: deviceId, updated_at: Timestamp.fromMillis(mov.created_at) },
        { merge: true }
      );
      await localDb.update(movements).set({ sync_pending: false }).where(eq(movements.id, mov.id));
      result.pushed += 1;
    }

    try {
      const actsSnap = await getDocs(collection(firestore, `companies/${COMPANY_ID}/acts`));
      for (const docSnap of actsSnap.docs) {
        const remote = docSnap.data();
        const remoteUpdatedAt = toMillis(remote.updated_at);
        const actId = (remote.id as string) ?? docSnap.id;

        const localRows = await localDb.select().from(acts).where(eq(acts.id, actId)).limit(1);

        if (localRows.length === 0) {
          await localDb.insert(acts).values({
            id: actId,
            number: remote.number as string,
            type: remote.type as string,
            status: remote.status as string,
            date: remote.date as number,
            date_closed: remote.date_closed as number | undefined,
            warehouse_from: remote.warehouse_from as string | undefined,
            warehouse_to: remote.warehouse_to as string | undefined,
            supplier: remote.supplier as string | undefined,
            invoice_number: remote.invoice_number as string | undefined,
            client_name: remote.client_name as string | undefined,
            client_contact: remote.client_contact as string | undefined,
            client_address: remote.client_address as string | undefined,
            channel: remote.channel as string | undefined,
            responsible_user: remote.responsible_user as string | undefined,
            checked_by: remote.checked_by as string | undefined,
            packaging_type: remote.packaging_type as string | undefined,
            sku_finished: remote.sku_finished as string | undefined,
            wc_order_id: remote.wc_order_id as string | undefined,
            notes: remote.notes as string | undefined,
            pdf_path: remote.pdf_path as string | undefined,
            gdrive_id: remote.gdrive_id as string | undefined,
            created_at: (remote.created_at as number) ?? remoteUpdatedAt,
            updated_at: remoteUpdatedAt,
            device_id: (remote.device_id as string) ?? deviceId,
            sync_pending: false,
          });
          result.pulled += 1;
        } else if (remoteUpdatedAt > localRows[0].updated_at && localRows[0].status !== 'draft') {
          await localDb
            .update(acts)
            .set({
              number: remote.number as string,
              type: remote.type as string,
              status: remote.status as string,
              date: remote.date as number,
              date_closed: remote.date_closed as number | undefined,
              warehouse_from: remote.warehouse_from as string | undefined,
              warehouse_to: remote.warehouse_to as string | undefined,
              supplier: remote.supplier as string | undefined,
              invoice_number: remote.invoice_number as string | undefined,
              client_name: remote.client_name as string | undefined,
              client_contact: remote.client_contact as string | undefined,
              client_address: remote.client_address as string | undefined,
              channel: remote.channel as string | undefined,
              responsible_user: remote.responsible_user as string | undefined,
              checked_by: remote.checked_by as string | undefined,
              packaging_type: remote.packaging_type as string | undefined,
              sku_finished: remote.sku_finished as string | undefined,
              wc_order_id: remote.wc_order_id as string | undefined,
              notes: remote.notes as string | undefined,
              pdf_path: remote.pdf_path as string | undefined,
              gdrive_id: remote.gdrive_id as string | undefined,
              updated_at: remoteUpdatedAt,
              sync_pending: false,
            })
            .where(eq(acts.id, actId));
          result.pulled += 1;
        }
      }

      const movementsSnap = await getDocs(collection(firestore, `companies/${COMPANY_ID}/movements`));
      for (const docSnap of movementsSnap.docs) {
        const remote = docSnap.data();
        const remoteUpdatedAt = toMillis(remote.updated_at ?? remote.created_at);
        const movId = (remote.id as string) ?? docSnap.id;

        const localRows = await localDb.select().from(movements).where(eq(movements.id, movId)).limit(1);

        if (localRows.length === 0) {
          await localDb.insert(movements).values({
            id: movId,
            date: remote.date as number,
            act_id: remote.act_id as string,
            act_number: remote.act_number as string,
            operation_type: remote.operation_type as string,
            warehouse_from: remote.warehouse_from as string | undefined,
            warehouse_to: remote.warehouse_to as string | undefined,
            sku: remote.sku as string,
            product_name: remote.product_name as string,
            unit: remote.unit as string,
            qty_in: remote.qty_in as number | undefined,
            qty_out: remote.qty_out as number | undefined,
            responsible: remote.responsible as string | undefined,
            channel: remote.channel as string | undefined,
            status: remote.status as string | undefined,
            notes: remote.notes as string | undefined,
            created_at: (remote.created_at as number) ?? remoteUpdatedAt,
            device_id: (remote.device_id as string) ?? deviceId,
            sync_pending: false,
          });
          result.pulled += 1;
        } else if (remoteUpdatedAt > localRows[0].created_at) {
          await localDb
            .update(movements)
            .set({
              date: remote.date as number,
              act_id: remote.act_id as string,
              act_number: remote.act_number as string,
              operation_type: remote.operation_type as string,
              warehouse_from: remote.warehouse_from as string | undefined,
              warehouse_to: remote.warehouse_to as string | undefined,
              sku: remote.sku as string,
              product_name: remote.product_name as string,
              unit: remote.unit as string,
              qty_in: remote.qty_in as number | undefined,
              qty_out: remote.qty_out as number | undefined,
              responsible: remote.responsible as string | undefined,
              channel: remote.channel as string | undefined,
              status: remote.status as string | undefined,
              notes: remote.notes as string | undefined,
              sync_pending: false,
            })
            .where(eq(movements.id, movId));
          result.pulled += 1;
        }
      }

      const productsSnap = await getDocs(collection(firestore, `companies/${COMPANY_ID}/products`));
      for (const docSnap of productsSnap.docs) {
        const remote = docSnap.data();
        if (remote.is_material === true) continue;

        const remoteUpdatedAt = toMillis(remote.updated_at);
        const productId = (remote.id as string) ?? docSnap.id;

        const localRows = await localDb.select().from(products).where(eq(products.id, productId)).limit(1);

        if (localRows.length === 0) {
          await localDb.insert(products).values({
            id: productId,
            name: remote.name as string,
            name_ru: remote.name_ru as string | undefined,
            category: remote.category as string,
            channel: remote.channel as string,
            packaging: remote.packaging as string,
            weight_g: remote.weight_g as number | undefined,
            price_rrp: remote.price_rrp as number | undefined,
            price_opt: remote.price_opt as number | undefined,
            price_opt_no_vat: remote.price_opt_no_vat as number | undefined,
            vat_amount: remote.vat_amount as number | undefined,
            discount_pct: remote.discount_pct as number | undefined,
            warehouse: remote.warehouse as string,
            barcode: remote.barcode as string | undefined,
            is_material: false,
            is_active: remote.is_active !== false,
            notes: remote.notes as string | undefined,
            updated_at: remoteUpdatedAt,
            sync_pending: false,
          });
          result.pulled += 1;
        } else if (localRows[0].is_material) {
          continue;
        } else if (remoteUpdatedAt > localRows[0].updated_at) {
          await localDb
            .update(products)
            .set({
              name: remote.name as string,
              name_ru: remote.name_ru as string | undefined,
              category: remote.category as string,
              channel: remote.channel as string,
              packaging: remote.packaging as string,
              weight_g: remote.weight_g as number | undefined,
              price_rrp: remote.price_rrp as number | undefined,
              price_opt: remote.price_opt as number | undefined,
              price_opt_no_vat: remote.price_opt_no_vat as number | undefined,
              vat_amount: remote.vat_amount as number | undefined,
              discount_pct: remote.discount_pct as number | undefined,
              warehouse: remote.warehouse as string,
              barcode: remote.barcode as string | undefined,
              is_active: remote.is_active !== false,
              notes: remote.notes as string | undefined,
              updated_at: remoteUpdatedAt,
              sync_pending: false,
            })
            .where(eq(products.id, productId));
          result.pulled += 1;
        }
      }
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
