import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Papa from 'papaparse';
import { format } from 'date-fns';
import { getProducts, getMovements, getActs, getActLines, calcAccountingStock } from '@/src/db/queries';

export async function exportProductsCsv(): Promise<string> {
  const products = await getProducts();
  const rows = products.map((p) => ({
    sku: p.id,
    name: p.name,
    category: p.category,
    channel: p.channel,
    packaging: p.packaging,
    weight_g: p.weight_g,
    price_rrp: p.price_rrp,
    price_opt: p.price_opt,
    price_opt_no_vat: p.price_opt_no_vat,
    vat_amount: p.vat_amount,
    discount_pct: p.discount_pct,
    warehouse: p.warehouse,
    barcode: p.barcode,
    is_material: p.is_material,
    is_active: p.is_active,
    notes: p.notes,
    updated_at: p.updated_at,
  }));

  const csv = Papa.unparse(rows);
  const filename = `products_export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  const path = `${FileSystem.documentDirectory ?? ''}${filename}`;
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  return path;
}

export async function exportMovementsCsv(from?: number, to?: number): Promise<string> {
  const movements = await getMovements(from, to);
  const rows = movements.map((m) => ({
    date: format(new Date(m.date), 'yyyy-MM-dd'),
    act_number: m.act_number,
    operation_type: m.operation_type,
    warehouse_from: m.warehouse_from,
    warehouse_to: m.warehouse_to,
    sku: m.sku,
    product_name: m.product_name,
    unit: m.unit,
    qty_in: m.qty_in,
    qty_out: m.qty_out,
    responsible: m.responsible,
    channel: m.channel,
    status: m.status,
  }));

  const csv = Papa.unparse(rows);
  const filename = `movements_${format(new Date(), 'yyyy-MM')}.csv`;
  const path = `${FileSystem.documentDirectory ?? ''}${filename}`;
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  return path;
}

export async function exportActsCsv(from?: number, to?: number): Promise<string> {
  const actsList = await getActs({ dateFrom: from, dateTo: to });
  const rows = [];
  for (const act of actsList) {
    const lines = await getActLines(act.id);
    for (const line of lines) {
      rows.push({
        act_number: act.number,
        act_type: act.type,
        act_date: format(new Date(act.date), 'yyyy-MM-dd'),
        sku: line.sku,
        product_name: line.product_name,
        qty_planned: line.qty_planned,
        qty_actual: line.qty_actual,
        amount: line.amount,
      });
    }
  }

  const csv = Papa.unparse(rows);
  const filename = `acts_${format(new Date(), 'yyyy-MM')}.csv`;
  const path = `${FileSystem.documentDirectory ?? ''}${filename}`;
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  return path;
}

export async function exportStockCsv(): Promise<string> {
  const stock = await calcAccountingStock();
  const rows = stock.map((s) => ({
    warehouse: s.warehouse,
    sku: s.sku,
    product_name: s.product_name,
    unit: s.unit,
    qty: s.qty,
  }));

  const csv = Papa.unparse(rows);
  const filename = `stock_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  const path = `${FileSystem.documentDirectory ?? ''}${filename}`;
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  return path;
}

export async function shareCsv(path: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Экспорт CSV' });
  }
}

export interface CsvPreviewResult {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

export function previewCsv(content: string): CsvPreviewResult {
  const parsed = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true });
  return {
    headers: parsed.meta.fields ?? [],
    rows: parsed.data.slice(0, 10),
    totalRows: parsed.data.length,
  };
}

export function validateProductsCsv(headers: string[]): boolean {
  const required = ['sku', 'name', 'category', 'channel', 'warehouse'];
  return required.every((h) => headers.includes(h));
}
