import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Papa from 'papaparse';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/src/db/client';
import { products, movements } from '@/src/db/schema';
import { previewCsv, validateProductsCsv } from './exporter';
import { getFullDeviceId } from '@/src/utils/deviceId';

export async function pickCsvFile(): Promise<{ path: string; content: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'application/csv'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const content = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return { path: asset.uri, content };
}

function parseBool(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (val === 'true' || val === '1') return true;
  return false;
}

function parseNum(val: unknown): number | undefined {
  if (val == null || val === '') return undefined;
  const n = parseFloat(String(val));
  return isNaN(n) ? undefined : n;
}

export async function importProductsCsv(
  content: string,
  mode: 'merge' | 'replace'
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const parsed = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true });
  const headers = parsed.meta.fields ?? [];
  const errors: string[] = [];

  if (!validateProductsCsv(headers)) {
    return { imported: 0, skipped: 0, errors: ['Неверный формат CSV: отсутствуют обязательные колонки'] };
  }

  const preview = previewCsv(content);
  const db = getDb();
  let imported = 0;
  let skipped = 0;

  if (mode === 'replace') {
    await db.delete(products).where(eq(products.is_material, false));
  }

  for (const row of parsed.data) {
    const sku = row.sku?.trim();
    if (!sku) {
      errors.push('Строка без SKU пропущена');
      skipped += 1;
      continue;
    }

    if (parseBool(row.is_material)) {
      skipped += 1;
      continue;
    }

    const csvUpdatedAt = parseNum(row.updated_at) ?? Date.now();
    const existing = await db.select().from(products).where(eq(products.id, sku)).limit(1);

    const values = {
      id: sku,
      name: row.name ?? sku,
      name_ru: row.name_ru || undefined,
      category: row.category ?? 'Прочее',
      channel: row.channel ?? '—',
      packaging: row.packaging ?? 'шт',
      weight_g: parseNum(row.weight_g),
      price_rrp: parseNum(row.price_rrp),
      price_opt: parseNum(row.price_opt),
      price_opt_no_vat: parseNum(row.price_opt_no_vat),
      vat_amount: parseNum(row.vat_amount),
      discount_pct: parseNum(row.discount_pct),
      warehouse: row.warehouse ?? 'WH-01',
      barcode: row.barcode || undefined,
      is_material: false,
      is_active: row.is_active !== 'false',
      notes: row.notes || undefined,
      updated_at: csvUpdatedAt,
      sync_pending: true,
    };

    if (existing.length === 0) {
      await db.insert(products).values(values);
      imported += 1;
    } else if (existing[0].is_material) {
      skipped += 1;
    } else if (mode === 'merge' && csvUpdatedAt <= existing[0].updated_at) {
      skipped += 1;
    } else {
      await db.update(products).set(values).where(eq(products.id, sku));
      imported += 1;
    }
  }

  if (preview.totalRows === 0) {
    errors.push('CSV файл пуст');
  }

  return { imported, skipped, errors };
}

export async function importMovementsCsv(
  content: string
): Promise<{ imported: number; duplicates: number }> {
  const parsed = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true });
  const db = getDb();
  const deviceId = await getFullDeviceId();
  const existing = await db.select().from(movements);

  let imported = 0;
  let duplicates = 0;

  for (const row of parsed.data) {
    const sku = row.sku?.trim();
    const actNumber = row.act_number?.trim();
    if (!sku || !actNumber) continue;

    const dateStr = row.date ?? '';
    const qtyIn = parseNum(row.qty_in);
    const qtyOut = parseNum(row.qty_out);

    const isDuplicate = existing.some(
      (m) =>
        m.act_number === actNumber &&
        m.sku === sku &&
        m.qty_in === qtyIn &&
        m.qty_out === qtyOut &&
        new Date(m.date).toISOString().slice(0, 10) === dateStr
    );

    if (isDuplicate) {
      duplicates += 1;
      continue;
    }

    const dateTs = dateStr ? new Date(dateStr).getTime() : Date.now();
    const id = uuidv4();

    await db.insert(movements).values({
      id,
      date: dateTs,
      act_id: row.act_id ?? id,
      act_number: actNumber,
      operation_type: row.operation_type ?? 'Импорт CSV',
      warehouse_from: row.warehouse_from || undefined,
      warehouse_to: row.warehouse_to || undefined,
      sku,
      product_name: row.product_name ?? sku,
      unit: row.unit ?? 'шт',
      qty_in: qtyIn,
      qty_out: qtyOut,
      responsible: row.responsible || undefined,
      channel: row.channel || undefined,
      status: row.status ?? 'Проведён',
      created_at: Date.now(),
      device_id: deviceId,
      sync_pending: true,
    });

    imported += 1;
  }

  return { imported, duplicates };
}
