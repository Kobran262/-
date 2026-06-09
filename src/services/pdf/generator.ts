import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Act, ActLine } from '@/src/types';
import { ACT_TYPE_LABELS } from '@/src/types';
import { getUserById } from '@/src/db/queries';

export interface ActPdfData {
  act: Act;
  lines: ActLine[];
  responsible_full_name: string;
  checked_full_name: string;
}

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

function buildReceiptHtml(data: ActPdfData): string {
  const { act, lines, responsible_full_name } = data;
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
      <div class="sig-block">Товар принял: ${responsible_full_name}<div class="sig-line"></div></div>
      <div class="sig-block">Товар передал (поставщик):<div class="sig-line"></div></div>
    </div>
    <div class="footer">Srecha WMS · ${format(new Date(), 'dd.MM.yyyy HH:mm')}</div>
  </body></html>`;
}

function buildTransferHtml(data: ActPdfData): string {
  const { act, lines, responsible_full_name, checked_full_name } = data;
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
      <div class="sig-block">Передал: ${responsible_full_name}<div class="sig-line"></div></div>
      <div class="sig-block">Принял: ${checked_full_name}<div class="sig-line"></div></div>
    </div>
  </body></html>`;
}

function buildShipmentHtml(data: ActPdfData): string {
  const { act, lines, responsible_full_name, checked_full_name } = data;
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
      <div class="sig-block">Отгрузил: ${responsible_full_name}<div class="sig-line"></div></div>
      <div class="sig-block">Принял: ${checked_full_name}<div class="sig-line"></div></div>
    </div>
  </body></html>`;
}

function buildPackagingCardHtml(data: ActPdfData): string {
  const { act, lines, responsible_full_name } = data;
  const rawLines = lines.filter((l) => l.unit === 'г' || l.unit === 'кг');
  const pkgLines = lines.filter(
    (l) => l.category === 'Упаковка' || l.sku.startsWith('PKG-')
  );
  const finishedLines = lines.filter((l) => l.sku === act.sku_finished);

  const rawRows = rawLines
    .map(
      (l, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${l.sku}</td>
      <td>${l.norm_per_unit ?? '—'}</td>
      <td>${l.qty_planned ?? '—'}</td>
      <td>${l.qty_planned != null && l.norm_per_unit != null ? (l.qty_planned * l.norm_per_unit).toFixed(0) : '—'}</td>
      <td>${l.qty_actual != null && l.norm_per_unit != null ? (l.qty_actual * l.norm_per_unit).toFixed(0) : '—'}</td>
      <td class="${(l.qty_diff ?? 0) < 0 ? 'diff-negative' : (l.qty_diff ?? 0) > 0 ? 'diff-positive' : ''}">${l.qty_diff != null && l.norm_per_unit != null ? (l.qty_diff * l.norm_per_unit).toFixed(0) : '—'}</td>
    </tr>`
    )
    .join('');

  const pkgRows = pkgLines
    .map(
      (l) => `
    <tr>
      <td>${l.product_name}</td>
      <td>${l.sku}</td>
      <td>${l.norm_per_unit ?? '—'}</td>
      <td>${l.qty_planned ?? '—'}</td>
      <td>${l.qty_actual ?? '—'}</td>
      <td class="${(l.qty_diff ?? 0) < 0 ? 'diff-negative' : (l.qty_diff ?? 0) > 0 ? 'diff-positive' : ''}">${l.qty_diff ?? '—'}</td>
    </tr>`
    )
    .join('');

  const finishedRows = finishedLines
    .map(
      (l) => `
    <tr>
      <td>${l.sku}</td>
      <td>${l.product_name}</td>
      <td>${act.packaging_type ?? '—'}</td>
      <td>${l.qty_planned ?? '—'}</td>
      <td>${l.qty_actual ?? '—'}</td>
      <td>${l.notes ?? '—'}</td>
    </tr>`
    )
    .join('');

  const statusLabel = act.status === 'closed' ? 'Закрыта' : act.status === 'draft' ? 'Черновик' : 'Активна';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${BASE_STYLES}
    .section-title { font-size: 11px; font-weight: bold; margin: 14px 0 6px; color: #1a1a1a; border-left: 3px solid #C8A96E; padding-left: 6px; }
  </style></head><body>
    <div class="header"><div class="company">DOO «Srecha»</div></div>
    <div class="act-title">КАРТА УПАКОВКИ <span class="act-number">${act.number}</span></div>
    <div style="text-align:center;color:#666;margin-bottom:10px;">WH-03 · Склад производства</div>
    <table class="meta-table">
      <tr><td class="meta-label">Номер карты:</td><td>${act.number}</td><td class="meta-label">Тип упаковки:</td><td>${act.packaging_type ?? '—'}</td></tr>
      <tr><td class="meta-label">Дата открытия:</td><td>${fmtDate(act.date)}</td><td class="meta-label">SKU готовой продукции:</td><td>${act.sku_finished ?? '—'}</td></tr>
      <tr><td class="meta-label">Дата закрытия:</td><td>${act.date_closed ? fmtDate(act.date_closed) : '—'}</td><td class="meta-label">Ответственный:</td><td>${responsible_full_name}</td></tr>
      <tr><td class="meta-label">Статус:</td><td colspan="3">${statusLabel}</td></tr>
    </table>

    <div class="section-title">Раздел 1 — Сырьё</div>
    <table class="lines-table">
      <thead><tr>
        <th>Сорт</th><th>SKU</th><th>Норма г/ед.</th><th>Кол-во ед.</th>
        <th>Расход план г</th><th>Расход факт г</th><th>Откл. г</th>
      </tr></thead>
      <tbody>${rawRows || '<tr><td colspan="7">—</td></tr>'}</tbody>
    </table>

    <div class="section-title">Раздел 2 — Упаковочные материалы</div>
    <table class="lines-table">
      <thead><tr>
        <th>Материал</th><th>Код WH-02</th><th>Норма/ед.</th><th>Кол-во ед. план</th>
        <th>Кол-во ед. факт</th><th>Откл.</th>
      </tr></thead>
      <tbody>${pkgRows || '<tr><td colspan="6">—</td></tr>'}</tbody>
    </table>

    <div class="section-title">Раздел 3 — Готовая продукция</div>
    <table class="lines-table">
      <thead><tr>
        <th>SKU</th><th>Наименование</th><th>Тип упак.</th><th>Кол-во план</th>
        <th>Кол-во факт</th><th>Передано на WH-04</th>
      </tr></thead>
      <tbody>${finishedRows || '<tr><td colspan="6">—</td></tr>'}</tbody>
    </table>

    <div class="signatures">
      <div class="sig-block">Карту открыл: ${responsible_full_name}<div class="sig-line"></div></div>
      <div class="sig-block">Карту закрыл:<div class="sig-line"></div></div>
      <div class="sig-block">Утвердил:<div class="sig-line"></div></div>
    </div>
    <div class="footer">Srecha WMS · ${format(new Date(), 'dd.MM.yyyy HH:mm')}</div>
  </body></html>`;
}

function buildGenericHtml(data: ActPdfData): string {
  const { act, lines, responsible_full_name } = data;
  const rows = lines
    .map(
      (l, i) =>
        `<tr><td>${i + 1}</td><td>${l.sku}</td><td>${l.product_name}</td><td>${l.unit}</td><td>${l.qty_actual ?? l.qty_planned ?? '—'}</td><td>${fmtMoney(l.amount)}</td></tr>`
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${BASE_STYLES}</style></head><body>
    <div class="header"><div class="company">DOO «Srecha»</div></div>
    <div class="act-title">${ACT_TYPE_LABELS[act.type as keyof typeof ACT_TYPE_LABELS] ?? act.type} <span class="act-number">${act.number}</span></div>
    <table class="meta-table">
      <tr><td class="meta-label">Дата:</td><td>${fmtDate(act.date)}</td></tr>
      <tr><td class="meta-label">Ответственный:</td><td>${responsible_full_name}</td></tr>
    </table>
    <table class="lines-table">
      <thead><tr><th>№</th><th>SKU</th><th>Наименование</th><th>Ед.</th><th>Кол-во</th><th>Сумма</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`;
}

export function buildActHtml(data: ActPdfData): string {
  switch (data.act.type) {
    case 'receipt':
      return buildReceiptHtml(data);
    case 'transfer':
      return buildTransferHtml(data);
    case 'packaging_card':
      return buildPackagingCardHtml(data);
    case 'shipment_b2b':
    case 'shipment_ecom':
      return buildShipmentHtml(data);
    default:
      return buildGenericHtml(data);
  }
}

export async function generateActPdf(act: Act, lines: ActLine[]): Promise<string> {
  const [responsibleUser, checkedUser] = await Promise.all([
    act.responsible_user ? getUserById(act.responsible_user) : null,
    act.checked_by ? getUserById(act.checked_by) : null,
  ]);

  const pdfData: ActPdfData = {
    act,
    lines,
    responsible_full_name: responsibleUser?.full_name ?? responsibleUser?.name ?? '___',
    checked_full_name: checkedUser?.full_name ?? checkedUser?.name ?? '___',
  };

  const html = buildActHtml(pdfData);
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

const INVENTORY_EXTRA_STYLES = `
  .section-header { background: #1a1a1a; color: #fff; padding: 5px 8px; font-size: 10px; font-weight: bold; }
  .diff-row { background: #FFF5F5 !important; }
  .summary-table { width: 100%; margin: 10px 0; font-size: 10px; }
  .summary-table td { padding: 3px 8px; }
  .summary-label { color: #666; width: 60%; }
  .summary-val { font-weight: bold; text-align: right; }
`;

export interface InventoryPdfData {
  act: {
    number: string;
    period_month: number;
    period_year: number;
    date_start: number;
    date_end?: number;
    commission?: string;
    status: string;
  };
  lines: Array<{
    sku: string;
    product_name: string;
    warehouse: string;
    unit: string;
    qty_accounting: number;
    qty_actual: number;
    qty_diff: number;
    diff_pct: number;
    reason?: string;
  }>;
}

const WH_LABELS: Record<string, string> = {
  'WH-01': 'WH-01 Склад сырья и приёмки',
  'WH-02': 'WH-02 Упаковочные материалы',
  'WH-03': 'WH-03 Склад готовой продукции',
  'WH-04': 'WH-04 Склад отгрузки',
};

const WH_ORDER = ['WH-01', 'WH-02', 'WH-03', 'WH-04'];

function fmtMonth(month: number, year: number): string {
  return format(new Date(year, month - 1, 1), 'LLLL yyyy', { locale: ru });
}

export function buildInventoryHtml(data: InventoryPdfData): string {
  const { act, lines } = data;
  const styles = BASE_STYLES + INVENTORY_EXTRA_STYLES;

  let whSections = '';
  for (const wh of WH_ORDER) {
    const whLines = lines.filter((l) => l.warehouse === wh);
    if (whLines.length === 0) continue;

    const diffCount = whLines.filter((l) => l.qty_diff !== 0).length;
    let rows = '';
    whLines.forEach((l, i) => {
      const diffClass = Math.abs(l.diff_pct) > 5 ? 'diff-row' : '';
      rows += `<tr class="${diffClass}">
        <td>${i + 1}</td><td>${l.sku}</td><td>${l.product_name}</td><td>${l.unit}</td>
        <td>${l.qty_accounting}</td><td>${l.qty_actual}</td>
        <td>${l.qty_diff > 0 ? '+' : ''}${l.qty_diff}</td><td>${l.diff_pct.toFixed(1)}%</td><td></td>
      </tr>`;
      if (l.reason) {
        rows += `<tr class="reason-row">
          <td colspan="5"></td>
          <td colspan="4" style="font-style:italic;color:#666;font-size:8px">Причина: ${l.reason}</td>
        </tr>`;
      }
    });

    whSections += `
      <tr><td colspan="9" class="section-header">${WH_LABELS[wh] ?? wh}</td></tr>
      ${rows}
      <tr><td colspan="9" style="font-size:9px;color:#666;padding:4px 6px">
        Итог по складу: ${whLines.length} позиций, ${diffCount} с отклонением
      </td></tr>`;
  }

  const totalLines = lines.length;
  const diffLines = lines.filter((l) => l.qty_diff !== 0);
  const bigDiff = lines.filter((l) => Math.abs(l.diff_pct) > 5).length;
  const diffPct = totalLines > 0 ? ((diffLines.length / totalLines) * 100).toFixed(1) : '0';

  const statusLabel = act.status === 'closed' ? 'Закрыта' : 'Черновик';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${styles}</style></head><body>
    <div class="header"><div class="company">DOO «Srecha»</div></div>
    <div class="act-title">ИНВЕНТАРИЗАЦИОННАЯ ВЕДОМОСТЬ <span class="act-number">${act.number}</span></div>
    <table class="meta-table">
      <tr><td class="meta-label">Период:</td><td>${fmtMonth(act.period_month, act.period_year)}</td></tr>
      <tr><td class="meta-label">Дата начала:</td><td>${fmtDate(act.date_start)}</td></tr>
      <tr><td class="meta-label">Дата окончания:</td><td>${act.date_end ? fmtDate(act.date_end) : '—'}</td></tr>
      <tr><td class="meta-label">Комиссия:</td><td>${act.commission ?? '—'}</td></tr>
      <tr><td class="meta-label">Статус:</td><td>${statusLabel}</td></tr>
    </table>
    <table class="lines-table">
      <thead><tr>
        <th>№</th><th>SKU</th><th>Наименование</th><th>Ед.</th>
        <th>Остаток учётный</th><th>Остаток факт</th><th>Разница</th><th>%</th><th>Причина</th>
      </tr></thead>
      <tbody>${whSections}</tbody>
    </table>
    <table class="summary-table">
      <tr><td class="summary-label">Всего позиций:</td><td class="summary-val">${totalLines}</td></tr>
      <tr><td class="summary-label">С отклонением:</td><td class="summary-val">${diffLines.length} (${diffPct}%)</td></tr>
      <tr><td class="summary-label">Общее отклонение &gt; 5%:</td><td class="summary-val">${bigDiff}</td></tr>
    </table>
    <div style="margin-top:24px">
      <div style="font-size:10px;margin-bottom:8px">Подписи комиссии:</div>
      <div class="signatures">
        <div class="sig-block"><div class="sig-line"></div></div>
        <div class="sig-block"><div class="sig-line"></div></div>
        <div class="sig-block"><div class="sig-line"></div></div>
      </div>
    </div>
    <div class="footer">Srecha WMS · ${format(new Date(), 'dd.MM.yyyy HH:mm')}</div>
  </body></html>`;
}

export async function generateInventoryPdf(data: InventoryPdfData): Promise<string> {
  const html = buildInventoryHtml(data);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const actsDir = `${FileSystem.documentDirectory ?? ''}acts/`;
  await FileSystem.makeDirectoryAsync(actsDir, { intermediates: true });

  const monthPadded = String(data.act.period_month).padStart(2, '0');
  const filename = `${data.act.number}_${data.act.period_year}-${monthPadded}.pdf`.replace(/\//g, '-');
  const destPath = `${actsDir}${filename}`;

  await FileSystem.moveAsync({ from: uri, to: destPath });
  return destPath;
}
