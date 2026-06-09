import { eq, desc, and, like, or, gte, lte, sql, inArray, notInArray } from 'drizzle-orm';
import { getDb } from '@/src/db/client';
import { acts, act_lines, products, movements, users, inventory_acts, inventory_lines } from '@/src/db/schema';
import type { ActType, ActStatus, WarehouseId } from '@/src/types';
import { uuidv4 } from '@/src/utils/uuid';
import { generateActNumber, calcQtyDiff, calcLineAmount } from '@/src/utils/actNumbers';
import { getFullDeviceId } from '@/src/utils/deviceId';
import { markActForSync } from '@/src/firebase/sync';
import {
  getProductFilter,
  calcPriority,
  warehouseSortIndex,
  ALL_CATEGORIES,
  type ProductQueryContext,
} from '@/src/utils/productContext';

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

export async function getProductsForAct(
  ctx: ProductQueryContext,
  search?: string
): Promise<Array<(typeof products.$inferSelect) & { priority: number }>> {
  const db = getDb();
  const filter = getProductFilter(ctx);
  const conditions = [eq(products.is_active, true)];

  if (filter.onlyMaterials) conditions.push(eq(products.is_material, true));
  if (filter.excludeMaterials) conditions.push(eq(products.is_material, false));
  if (filter.categories?.length) conditions.push(inArray(products.category, filter.categories));
  if (filter.excludeCategories?.length) {
    conditions.push(notInArray(products.category, filter.excludeCategories));
  }
  if (filter.channels?.length) conditions.push(inArray(products.channel, filter.channels));

  if (search) {
    conditions.push(
      or(
        like(products.name, `%${search}%`),
        like(products.id, `%${search}%`),
        like(products.barcode, `%${search}%`)
      )!
    );
  }

  const rows = await db
    .select()
    .from(products)
    .where(and(...conditions));

  const withPriority = rows.map((p) => ({
    ...p,
    priority: calcPriority(p, filter.priorityRules),
  }));

  if (ctx.actType === 'inventory') {
    return withPriority.sort((a, b) => {
      const whDiff = warehouseSortIndex(a.warehouse) - warehouseSortIndex(b.warehouse);
      if (whDiff !== 0) return whDiff;
      return a.name.localeCompare(b.name, 'ru');
    });
  }

  return withPriority.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.name.localeCompare(b.name, 'ru');
  });
}

export async function getProductsCatalog(filters?: {
  search?: string;
  category?: string;
  channel?: string;
  warehouse?: string;
  onlyMaterials?: boolean;
  onlyTea?: boolean;
  onlyEquipment?: boolean;
  includeInactive?: boolean;
}) {
  const db = getDb();
  const conditions = [];

  if (!filters?.includeInactive) conditions.push(eq(products.is_active, true));
  if (filters?.onlyMaterials) conditions.push(eq(products.is_material, true));
  if (filters?.onlyTea) {
    conditions.push(eq(products.is_material, false));
    conditions.push(
      notInArray(products.category, [
        'Чайники',
        'Воронки',
        'Аксессуары',
        'Матча',
        'Посуда',
        'Расходники',
        'Прочее',
      ])
    );
  }
  if (filters?.onlyEquipment) {
    conditions.push(
      inArray(products.category, [
        'Чайники',
        'Воронки',
        'Аксессуары',
        'Матча',
        'Посуда',
        'Расходники',
      ])
    );
  }
  if (filters?.category) conditions.push(eq(products.category, filters.category));
  if (filters?.channel) conditions.push(eq(products.channel, filters.channel));
  if (filters?.warehouse) conditions.push(eq(products.warehouse, filters.warehouse));
  if (filters?.search) {
    conditions.push(
      or(
        like(products.name, `%${filters.search}%`),
        like(products.id, `%${filters.search}%`),
        like(products.barcode, `%${filters.search}%`)
      )!
    );
  }

  const rows =
    conditions.length > 0
      ? await db.select().from(products).where(and(...conditions))
      : await db.select().from(products);

  const categoryOrder = (cat: string) => {
    const idx = ALL_CATEGORIES.indexOf(cat);
    return idx >= 0 ? idx : ALL_CATEGORIES.length;
  };

  return rows.sort((a, b) => {
    const catDiff = categoryOrder(a.category) - categoryOrder(b.category);
    if (catDiff !== 0) return catDiff;
    return a.name.localeCompare(b.name, 'ru');
  });
}

export async function createProduct(
  input: Omit<typeof products.$inferInsert, 'updated_at' | 'sync_pending'>
): Promise<string> {
  const db = getDb();
  const now = Date.now();
  await db.insert(products).values({
    ...input,
    updated_at: now,
    sync_pending: true,
  });
  return input.id;
}

export async function updateProduct(
  sku: string,
  updates: Partial<Omit<typeof products.$inferInsert, 'id' | 'updated_at'>>
): Promise<void> {
  const db = getDb();
  await db
    .update(products)
    .set({ ...updates, updated_at: Date.now(), sync_pending: true })
    .where(eq(products.id, sku));
}

export async function toggleProductActive(sku: string): Promise<void> {
  const db = getDb();
  const rows = await db.select().from(products).where(eq(products.id, sku)).limit(1);
  if (!rows[0]) return;
  await db
    .update(products)
    .set({
      is_active: !rows[0].is_active,
      updated_at: Date.now(),
      sync_pending: true,
    })
    .where(eq(products.id, sku));
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

  const [openRes, draftsRes, todayRes, closedTodayRes] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(acts).where(eq(acts.status, 'active')),
    db.select({ count: sql<number>`count(*)` }).from(acts).where(eq(acts.status, 'draft')),
    db.select({ count: sql<number>`count(*)` }).from(acts).where(gte(acts.date, todayTs)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(acts)
      .where(and(eq(acts.status, 'closed'), gte(acts.date_closed, todayTs))),
  ]);

  return {
    open: openRes[0]?.count ?? 0,
    drafts: draftsRes[0]?.count ?? 0,
    today: todayRes[0]?.count ?? 0,
    closedToday: closedTodayRes[0]?.count ?? 0,
  };
}

export async function getRecentActs(limit = 5) {
  const db = getDb();
  return db.select().from(acts).orderBy(desc(acts.updated_at)).limit(limit);
}

export async function getRecentActsWithDetails(limit = 5) {
  const db = getDb();
  const recent = await db.select().from(acts).orderBy(desc(acts.updated_at)).limit(limit);

  if (recent.length === 0) return [];

  const actIds = recent.map((a) => a.id);
  const counts = await db
    .select({
      act_id: act_lines.act_id,
      count: sql<number>`count(*)`,
    })
    .from(act_lines)
    .where(inArray(act_lines.act_id, actIds))
    .groupBy(act_lines.act_id);

  const countMap = new Map(counts.map((c) => [c.act_id, c.count]));

  return recent.map((act) => ({
    ...act,
    lineCount: countMap.get(act.id) ?? 0,
  }));
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

export async function getUserById(id: string) {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateActLine(
  lineId: string,
  updates: {
    qty_actual?: number;
    qty_planned?: number;
    price_unit?: number;
    notes?: string;
    condition?: string;
  }
): Promise<void> {
  const db = getDb();
  const existing = await db.select().from(act_lines).where(eq(act_lines.id, lineId)).limit(1);
  if (!existing[0]) return;

  const line = existing[0];
  const qty_planned = updates.qty_planned ?? line.qty_planned;
  const qty_actual = updates.qty_actual ?? line.qty_actual;
  const price_unit = updates.price_unit ?? line.price_unit;
  const qty_diff = calcQtyDiff(qty_planned, qty_actual);
  const amount = calcLineAmount(qty_actual, price_unit);

  await db
    .update(act_lines)
    .set({
      ...updates,
      qty_planned,
      qty_actual,
      price_unit,
      qty_diff,
      amount,
      updated_at: Date.now(),
    })
    .where(eq(act_lines.id, lineId));

  await db.update(acts).set({ updated_at: Date.now() }).where(eq(acts.id, line.act_id));
}

export async function calcAccountingStock(): Promise<
  Array<{ sku: string; product_name: string; warehouse: string; unit: string; qty: number }>
> {
  const db = getDb();
  const allMovements = await db.select().from(movements);
  const allProducts = await db.select().from(products).where(eq(products.is_active, true));

  const stockMap = new Map<
    string,
    { sku: string; product_name: string; warehouse: string; unit: string; qty: number }
  >();

  for (const m of allMovements) {
    if (m.qty_in && m.warehouse_to) {
      const key = `${m.sku}|${m.warehouse_to}`;
      const cur = stockMap.get(key) ?? {
        sku: m.sku,
        product_name: m.product_name,
        warehouse: m.warehouse_to,
        unit: m.unit,
        qty: 0,
      };
      cur.qty += m.qty_in;
      stockMap.set(key, cur);
    }
    if (m.qty_out && m.warehouse_from) {
      const key = `${m.sku}|${m.warehouse_from}`;
      const cur = stockMap.get(key) ?? {
        sku: m.sku,
        product_name: m.product_name,
        warehouse: m.warehouse_from,
        unit: m.unit,
        qty: 0,
      };
      cur.qty -= m.qty_out;
      stockMap.set(key, cur);
    }
  }

  const warehouses = ['WH-01', 'WH-02', 'WH-03', 'WH-04'];
  for (const p of allProducts) {
    for (const wh of warehouses) {
      const key = `${p.id}|${wh}`;
      if (!stockMap.has(key) && p.warehouse === wh) {
        stockMap.set(key, {
          sku: p.id,
          product_name: p.name,
          warehouse: wh,
          unit: p.packaging === 'bulk' ? 'кг' : 'шт',
          qty: 0,
        });
      }
    }
  }

  return Array.from(stockMap.values()).sort(
    (a, b) => a.warehouse.localeCompare(b.warehouse) || a.sku.localeCompare(b.sku)
  );
}

export async function getInventoryActs() {
  const db = getDb();
  return db.select().from(inventory_acts).orderBy(desc(inventory_acts.date_start));
}

export async function getInventoryActById(id: string) {
  const db = getDb();
  const rows = await db.select().from(inventory_acts).where(eq(inventory_acts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getInventoryLines(inventoryId: string, warehouse?: string) {
  const db = getDb();
  const conditions = [eq(inventory_lines.inventory_id, inventoryId)];
  if (warehouse) conditions.push(eq(inventory_lines.warehouse, warehouse));
  return db
    .select()
    .from(inventory_lines)
    .where(and(...conditions))
    .orderBy(inventory_lines.warehouse, inventory_lines.sku);
}

export async function createInventoryAct(params: {
  period_month: number;
  period_year: number;
  commission: string;
}): Promise<{ id: string; number: string }> {
  const db = getDb();
  const deviceId = await getFullDeviceId();
  const number = await generateActNumber('inventory');
  const now = Date.now();
  const id = uuidv4();

  await db.insert(inventory_acts).values({
    id,
    number,
    period_month: params.period_month,
    period_year: params.period_year,
    date_start: now,
    commission: params.commission,
    status: 'draft',
    created_at: now,
    updated_at: now,
    device_id: deviceId,
    sync_pending: false,
  });

  const stock = await calcAccountingStock();
  for (const item of stock) {
    await db.insert(inventory_lines).values({
      id: uuidv4(),
      inventory_id: id,
      sku: item.sku,
      product_name: item.product_name,
      warehouse: item.warehouse,
      unit: item.unit,
      qty_accounting: item.qty,
      qty_actual: item.qty,
      qty_diff: 0,
      diff_pct: 0,
      updated_at: now,
    });
  }

  return { id, number };
}

export async function updateInventoryLine(
  lineId: string,
  qty_actual: number,
  reason?: string,
  manually_entered = true
): Promise<void> {
  const db = getDb();
  const rows = await db.select().from(inventory_lines).where(eq(inventory_lines.id, lineId)).limit(1);
  if (!rows[0]) return;

  const line = rows[0];
  const accounting = line.qty_accounting ?? 0;
  const qty_diff = qty_actual - accounting;
  const diff_pct = accounting !== 0 ? (qty_diff / accounting) * 100 : qty_actual !== 0 ? 100 : 0;

  await db
    .update(inventory_lines)
    .set({
      qty_actual,
      qty_diff,
      diff_pct,
      reason: reason ?? line.reason,
      manually_entered,
      updated_at: Date.now(),
    })
    .where(eq(inventory_lines.id, lineId));
}

export async function addInventoryLine(
  inventoryId: string,
  params: {
    sku: string;
    product_name: string;
    warehouse: WarehouseId;
    unit: string;
    qty_actual?: number;
  }
): Promise<void> {
  const db = getDb();
  const existing = await db
    .select()
    .from(inventory_lines)
    .where(and(eq(inventory_lines.inventory_id, inventoryId), eq(inventory_lines.sku, params.sku)))
    .limit(1);

  if (existing.length > 0) {
    await updateInventoryLine(existing[0].id, params.qty_actual ?? 0);
    return;
  }

  const qty_actual = params.qty_actual ?? 0;
  const now = Date.now();

  await db.insert(inventory_lines).values({
    id: uuidv4(),
    inventory_id: inventoryId,
    sku: params.sku,
    product_name: params.product_name,
    warehouse: params.warehouse,
    unit: params.unit,
    qty_accounting: 0,
    qty_actual,
    qty_diff: qty_actual,
    diff_pct: qty_actual !== 0 ? 100 : 0,
    manually_entered: true,
    updated_at: now,
  });
}

export async function closeInventoryAct(inventoryId: string): Promise<void> {
  const db = getDb();
  const now = Date.now();
  await db
    .update(inventory_acts)
    .set({ status: 'closed', date_end: now, updated_at: now })
    .where(eq(inventory_acts.id, inventoryId));
}
