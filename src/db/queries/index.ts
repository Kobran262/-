import { eq, desc, and, like, or, gte, lte, sql } from 'drizzle-orm';
import { getDb } from '@/src/db/client';
import { acts, act_lines, products, movements, users } from '@/src/db/schema';
import type { ActType, ActStatus } from '@/src/types';
import { v4 as uuidv4 } from 'uuid';
import { generateActNumber, calcQtyDiff, calcLineAmount } from '@/src/utils/actNumbers';
import { getFullDeviceId } from '@/src/utils/deviceId';
import { markActForSync } from '@/src/firebase/sync';

export async function getProducts(search?: string, category?: string) {
  const db = getDb();
  const conditions = [eq(products.is_active, true)];
  if (search) {
    conditions.push(
      or(
        like(products.name, `%${search}%`),
        like(products.id, `%${search}%`),
        like(products.barcode, `%${search}%`)
      )!
    );
  }
  if (category) {
    conditions.push(eq(products.category, category));
  }
  return db.select().from(products).where(and(...conditions)).orderBy(products.name);
}

export async function getProductByBarcode(barcode: string) {
  const db = getDb();
  const rows = await db.select().from(products).where(eq(products.barcode, barcode)).limit(1);
  return rows[0] ?? null;
}

export async function getProductBySku(sku: string) {
  const db = getDb();
  const rows = await db.select().from(products).where(eq(products.id, sku)).limit(1);
  return rows[0] ?? null;
}

export async function bindBarcode(sku: string, barcode: string) {
  const db = getDb();
  await db
    .update(products)
    .set({ barcode, updated_at: Date.now(), sync_pending: true })
    .where(eq(products.id, sku));
}

export async function getActs(filters?: {
  type?: ActType;
  status?: ActStatus;
  search?: string;
  dateFrom?: number;
  dateTo?: number;
}) {
  const db = getDb();
  const conditions = [];
  if (filters?.type) conditions.push(eq(acts.type, filters.type));
  if (filters?.status) conditions.push(eq(acts.status, filters.status));
  if (filters?.search) {
    conditions.push(
      or(like(acts.number, `%${filters.search}%`), like(acts.notes, `%${filters.search}%`))!
    );
  }
  if (filters?.dateFrom) conditions.push(gte(acts.date, filters.dateFrom));
  if (filters?.dateTo) conditions.push(lte(acts.date, filters.dateTo));

  const query = db.select().from(acts);
  if (conditions.length > 0) {
    return query.where(and(...conditions)).orderBy(desc(acts.date));
  }
  return query.orderBy(desc(acts.date));
}

export async function getActById(id: string) {
  const db = getDb();
  const rows = await db.select().from(acts).where(eq(acts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getActLines(actId: string) {
  const db = getDb();
  return db
    .select()
    .from(act_lines)
    .where(eq(act_lines.act_id, actId))
    .orderBy(act_lines.line_number);
}

export async function getActStats() {
  const db = getDb();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTs = todayStart.getTime();

  const all = await db.select().from(acts);
  return {
    open: all.filter((a) => a.status === 'active').length,
    drafts: all.filter((a) => a.status === 'draft').length,
    today: all.filter((a) => a.date >= todayTs).length,
    closedToday: all.filter((a) => a.status === 'closed' && (a.date_closed ?? a.date) >= todayTs)
      .length,
  };
}

export async function getRecentActs(limit = 5) {
  const db = getDb();
  return db.select().from(acts).orderBy(desc(acts.updated_at)).limit(limit);
}

export async function getRecentActsWithDetails(limit = 5) {
  const recent = await getRecentActs(limit);
  const db = getDb();
  return Promise.all(
    recent.map(async (act) => {
      const lines = await db
        .select({ count: sql<number>`count(*)` })
        .from(act_lines)
        .where(eq(act_lines.act_id, act.id));
      return { ...act, lineCount: lines[0]?.count ?? 0 };
    })
  );
}

export interface CreateActInput {
  type: ActType;
  date: number;
  warehouse_from?: string;
  warehouse_to?: string;
  supplier?: string;
  invoice_number?: string;
  client_name?: string;
  client_contact?: string;
  client_address?: string;
  channel?: string;
  responsible_user?: string;
  checked_by?: string;
  packaging_type?: string;
  sku_finished?: string;
  notes?: string;
}

export async function createAct(input: CreateActInput) {
  const db = getDb();
  const deviceId = await getFullDeviceId();
  const number = await generateActNumber(input.type);
  const now = Date.now();
  const id = uuidv4();

  await db.insert(acts).values({
    id,
    number,
    type: input.type,
    status: 'draft',
    date: input.date,
    warehouse_from: input.warehouse_from,
    warehouse_to: input.warehouse_to,
    supplier: input.supplier,
    invoice_number: input.invoice_number,
    client_name: input.client_name,
    client_contact: input.client_contact,
    client_address: input.client_address,
    channel: input.channel,
    responsible_user: input.responsible_user,
    checked_by: input.checked_by,
    packaging_type: input.packaging_type,
    sku_finished: input.sku_finished,
    notes: input.notes,
    created_at: now,
    updated_at: now,
    device_id: deviceId,
    sync_pending: false,
  });

  return { id, number };
}

export interface ActLineInput {
  sku: string;
  product_name: string;
  category?: string;
  unit: string;
  qty_planned?: number;
  qty_actual?: number;
  price_unit?: number;
  condition?: string;
  notes?: string;
}

export async function addActLine(actId: string, input: ActLineInput, lineNumber: number) {
  const db = getDb();
  const now = Date.now();
  const qtyDiff = calcQtyDiff(input.qty_planned, input.qty_actual);
  const amount = calcLineAmount(input.qty_actual ?? input.qty_planned, input.price_unit);

  await db.insert(act_lines).values({
    id: uuidv4(),
    act_id: actId,
    line_number: lineNumber,
    sku: input.sku,
    product_name: input.product_name,
    category: input.category,
    unit: input.unit,
    qty_planned: input.qty_planned,
    qty_actual: input.qty_actual,
    qty_diff: qtyDiff,
    price_unit: input.price_unit,
    amount,
    condition: input.condition ?? 'Норма',
    notes: input.notes,
    updated_at: now,
  });

  await db.update(acts).set({ updated_at: now }).where(eq(acts.id, actId));
}

export async function closeAct(actId: string, signature?: string) {
  const db = getDb();
  const act = await getActById(actId);
  if (!act || act.status === 'closed') return;

  const now = Date.now();
  const lines = await getActLines(actId);
  const deviceId = await getFullDeviceId();

  let userName = '';
  if (act.responsible_user) {
    const u = await db.select().from(users).where(eq(users.id, act.responsible_user)).limit(1);
    userName = u[0]?.name ?? '';
  }

  const operationMap: Record<string, string> = {
    receipt: 'Приёмка товара',
    transfer: `Передача → ${act.warehouse_to ?? ''}`,
    packaging_card: 'Упаковка / списание',
    shipment_b2b: 'Отгрузка B2B',
    shipment_ecom: 'Отгрузка E-com',
  };

  for (const line of lines) {
    const qty = line.qty_actual ?? line.qty_planned ?? 0;
    if (qty <= 0) continue;

    const isInbound = act.type === 'receipt';
    await db.insert(movements).values({
      id: uuidv4(),
      date: act.date,
      act_id: actId,
      act_number: act.number,
      operation_type: operationMap[act.type] ?? act.type,
      warehouse_from: act.warehouse_from,
      warehouse_to: act.warehouse_to ?? (isInbound ? 'WH-01' : undefined),
      sku: line.sku,
      product_name: line.product_name,
      unit: line.unit,
      qty_in: isInbound || act.type === 'transfer' ? qty : undefined,
      qty_out: act.type === 'shipment_b2b' || act.type === 'shipment_ecom' ? qty : undefined,
      responsible: userName,
      channel: act.channel,
      status: 'Проведён',
      created_at: now,
      device_id: deviceId,
      sync_pending: true,
    });
  }

  await db
    .update(acts)
    .set({
      status: 'closed',
      date_closed: now,
      notes: signature ? `${act.notes ?? ''}\nПодпись: ${signature}`.trim() : act.notes,
      updated_at: now,
      sync_pending: true,
    })
    .where(eq(acts.id, actId));

  await markActForSync(actId);
}

export async function deleteDraftAct(actId: string) {
  const db = getDb();
  const act = await getActById(actId);
  if (!act || act.status !== 'draft') return false;
  await db.delete(act_lines).where(eq(act_lines.act_id, actId));
  await db.delete(acts).where(eq(acts.id, actId));
  return true;
}

export async function getMovements(from?: number, to?: number) {
  const db = getDb();
  const conditions = [];
  if (from) conditions.push(gte(movements.date, from));
  if (to) conditions.push(lte(movements.date, to));
  const q = db.select().from(movements);
  if (conditions.length > 0) {
    return q.where(and(...conditions)).orderBy(desc(movements.date));
  }
  return q.orderBy(desc(movements.date));
}

export async function getProductCount() {
  const db = getDb();
  const result = await db.select({ count: sql<number>`count(*)` }).from(products);
  return result[0]?.count ?? 0;
}

export async function getAllUsers() {
  const db = getDb();
  return db.select().from(users).orderBy(users.name);
}
