import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Act, ActLine } from '@/src/types';
import { ACT_TYPE_LABELS } from '@/src/types';

const BASE_STYLES = `
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10px; color: #1a1a1a; }
  .header { border-bottom: 2px solid #C8A96E; padding-bottom: 8px; margin-bottom: 12px; }
  .company { font-size: 14px; font-weight: bold; color: #1a1a1a; }
  .act-title { font-size: 16px; font-weight: bold; text-align: center; margin: 8px 0; }
  .act-number { color: #C8A96E; }
  .meta-table { width: 100%; margin-bottom: 10px; }
  .meta-table td { padding: 2px 4px; vertical-align: top; }
  .meta-label { color: #666; width: 35%; }
  .lines-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  .lines-table th { background: #1a1a1a; color: #fff; padding: 4px 6px; text-align: left; font-size: 9px; }
  .lines-table td { border-bottom: 1px solid #e0e0e0; padding: 3px 6px; font-size: 9px; }
  .lines-table tr:nth-child(even) { background: #f9f7f4; }
  .total-row { font-weight: bold; background: #f0ece4 !important; }
  .diff-negative { color: #E85D4A; }
  .diff-positive { color: #5BA85F; }
  .signatures { margin-top: 20px; display: flex; justify-content: space-between; }
  .sig-block { width: 45%; }
  .sig-line { border-bottom: 1px solid #999; margin-top: 20px; }
  .footer { font-size: 8px; color: #999; text-align: center; margin-top: 20px; }
`;

function fmtDate(ts: number): string {
  return format(new Date(ts), 'dd.MM.yyyy', { locale: ru });
}

function fmtMoney(n?: number | null): string {
  if (n == null) return '—';
  return n.toFixed(2);
}

function buildReceiptHtml(act: Act, lines: ActLine[]): string {
  const totalPlan = lines.reduce((s, l) => s + (l.qty_planned ?? 0) * (l.price_unit ?? 0), 0);
  const totalActual = lines.reduce((s, l) => s + (l.qty_actual ?? 0) * (l.price_unit ?? 0), 0);

  const rows = lines
    .map(
      (l, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${l.sku}</td>
      <td>${l.product_name}</td>
      <td>${l.category ?? ''}</td>
      <td>${l.unit}</td>
      <td>${l.qty_planned ?? '—'}</td>
      <td>${l.qty_actual ?? '—'}</td>
      <td class="${(l.qty_diff ?? 0) < 0 ? 'diff-negative' : (l.qty_diff ?? 0) > 0 ? 'diff-positive' : ''}">${l.qty_diff ?? '—'}</td>
      <td>${fmtMoney(l.price_unit)}</td>
      <td>${fmtMoney(l.amount)}</td>
      <td>${l.notes ?? ''}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${BASE_STYLES}</style></head><body>
    <div class="header"><div class="company">DOO «Srecha»</div></div>
    <div class="act-title">Акт приёмки товара <span class="act-number">${act.number}</span></div>
    <table class="meta-table">
      <tr><td class="meta-label">Дата:</td><td>${fmtDate(act.date)}</td></tr>
      <tr><td class="meta-label">Поставщик:</td><td>${act.supplier ?? '—'}</td></tr>
      <tr><td class="meta-label">Номер инвойса:</td><td>${act.invoice_number ?? '—'}</td></tr>
      <tr><td class="meta-label">Склад назначения:</td><td>WH-01</td></tr>
    </table>
    <table class="lines-table">
      <thead><tr>
        <th>№</th><th>SKU</th><th>Наименование</th><th>Кат.</th><th>Ед.</th>
        <th>По инвойсу</th><th>Факт</th><th>Разница</th><th>Цена, din</th><th>Сумма, din</th><th>Прим.</th>
      </tr></thead>
      <tbody>${rows}
        <tr class="total-row"><td colspan="9">Итого по инвойсу / факт</td><td>${fmtMoney(totalPlan)} / ${fmtMoney(totalActual)}</td><td></td></tr>
      </tbody>
    </table>
    <div class="signatures">
      <div class="sig-block">Товар принял:<div class="sig-line"></div></div>
      <div class="sig-block">Товар передал (поставщик):<div class="sig-line"></div></div>
    </div>
    <div class="footer">Srecha WMS · ${format(new Date(), 'dd.MM.yyyy HH:mm')}</div>
  </body></html>`;
}

function buildTransferHtml(act: Act, lines: ActLine[]): string {
  const rows = lines
    .map(
      (l, i) => `
    <tr>
      <td>${i + 1}</td><td>${l.sku}</td><td>${l.product_name}</td><td>${l.unit}</td>
      <td>${l.qty_planned ?? '—'}</td><td>${l.qty_actual ?? '—'}</td>
      <td>${l.qty_diff ?? '—'}</td><td>${fmtMoney(l.price_unit)}</td><td>${fmtMoney(l.amount)}</td>
      <td class="${l.condition === 'Брак' ? 'diff-negative' : 'diff-positive'}">${l.condition ?? 'Норма'}</td>
      <td>${l.notes ?? ''}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${BASE_STYLES}</style></head><body>
    <div class="header"><div class="company">DOO «Srecha»</div></div>
    <div class="act-title">Акт передачи <span class="act-number">${act.number}</span></div>
    <table class="meta-table">
      <tr><td class="meta-label">Дата:</td><td>${fmtDate(act.date)}</td></tr>
      <tr><td class="meta-label">Маршрут:</td><td>${act.warehouse_from} → ${act.warehouse_to}</td></tr>
    </table>
    <table class="lines-table">
      <thead><tr>
        <th>№</th><th>SKU</th><th>Наименование</th><th>Ед.</th><th>План</th><th>Факт</th>
        <th>Откл.</th><th>Цена</th><th>Сумма</th><th>Состояние</th><th>Прим.</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="signatures">
      <div class="sig-block">Передал:<div class="sig-line"></div></div>
      <div class="sig-block">Принял:<div class="sig-line"></div></div>
    </div>
  </body></html>`;
}

function buildShipmentHtml(act: Act, lines: ActLine[]): string {
  const total = lines.reduce((s, l) => s + (l.amount ?? 0), 0);
  const rows = lines
    .map(
      (l, i) => `
    <tr>
      <td>${i + 1}</td><td>${l.sku}</td><td>${l.product_name}</td><td>${l.unit}</td>
      <td>${l.qty_planned ?? '—'}</td><td>${l.qty_actual ?? '—'}</td>
      <td>${fmtMoney(l.price_unit)}</td><td>${fmtMoney(l.amount)}</td><td>${l.notes ?? ''}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${BASE_STYLES}</style></head><body>
    <div class="header"><div class="company">DOO «Srecha»</div></div>
    <div class="act-title">Акт отгрузки B2B <span class="act-number">${act.number}</span></div>
    <table class="meta-table">
      <tr><td class="meta-label">Дата:</td><td>${fmtDate(act.date)}</td></tr>
      <tr><td class="meta-label">Канал:</td><td>${act.channel ?? '—'}</td></tr>
      <tr><td class="meta-label">Клиент:</td><td>${act.client_name ?? '—'}</td></tr>
      <tr><td class="meta-label">Контакт:</td><td>${act.client_contact ?? '—'}</td></tr>
      <tr><td class="meta-label">Адрес:</td><td>${act.client_address ?? '—'}</td></tr>
      <tr><td class="meta-label">Инвойс:</td><td>${act.invoice_number ?? '—'}</td></tr>
    </table>
    <table class="lines-table">
      <thead><tr>
        <th>№</th><th>SKU</th><th>Наименование</th><th>Ед.</th><th>Заказ</th><th>Факт</th><th>Цена опт</th><th>Сумма</th><th>Прим.</th>
      </tr></thead>
      <tbody>${rows}
        <tr class="total-row"><td colspan="7">Итого к оплате</td><td>${fmtMoney(total)}</td><td></td></tr>
      </tbody>
    </table>
    <div class="signatures">
      <div class="sig-block">Отгрузил:<div class="sig-line"></div></div>
      <div class="sig-block">Принял:<div class="sig-line"></div></div>
    </div>
  </body></html>`;
}

function buildGenericHtml(act: Act, lines: ActLine[]): string {
  const rows = lines
    .map(
      (l, i) =>
        `<tr><td>${i + 1}</td><td>${l.sku}</td><td>${l.product_name}</td><td>${l.unit}</td><td>${l.qty_actual ?? l.qty_planned ?? '—'}</td><td>${fmtMoney(l.amount)}</td></tr>`
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${BASE_STYLES}</style></head><body>
    <div class="header"><div class="company">DOO «Srecha»</div></div>
    <div class="act-title">${ACT_TYPE_LABELS[act.type as keyof typeof ACT_TYPE_LABELS] ?? act.type} <span class="act-number">${act.number}</span></div>
    <table class="meta-table"><tr><td class="meta-label">Дата:</td><td>${fmtDate(act.date)}</td></tr></table>
    <table class="lines-table">
      <thead><tr><th>№</th><th>SKU</th><th>Наименование</th><th>Ед.</th><th>Кол-во</th><th>Сумма</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`;
}

export function buildActHtml(act: Act, lines: ActLine[]): string {
  switch (act.type) {
    case 'receipt':
      return buildReceiptHtml(act, lines);
    case 'transfer':
      return buildTransferHtml(act, lines);
    case 'shipment_b2b':
    case 'shipment_ecom':
      return buildShipmentHtml(act, lines);
    default:
      return buildGenericHtml(act, lines);
  }
}

export async function generateActPdf(act: Act, lines: ActLine[]): Promise<string> {
  const html = buildActHtml(act, lines);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const actsDir = `${FileSystem.documentDirectory ?? ''}acts/`;
  await FileSystem.makeDirectoryAsync(actsDir, { intermediates: true });

  const dateStr = format(new Date(act.date), 'yyyy-MM-dd');
  const filename = `${act.number}_${dateStr}.pdf`.replace(/\//g, '-');
  const destPath = `${actsDir}${filename}`;

  await FileSystem.moveAsync({ from: uri, to: destPath });
  return destPath;
}

export async function sharePdf(path: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: 'application/pdf', dialogTitle: 'Поделиться PDF' });
  }
}
