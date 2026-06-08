import { getProductsForAct } from '@/src/db/queries';

export interface VoiceCommand {
  type: 'shipment' | 'receipt' | 'transfer' | 'unknown';
  sku?: string;
  productName?: string;
  qty?: number;
  unit?: string;
  date?: number;
  confidence: number;
  raw: string;
  suggestion?: string;
}

const OPERATION_KEYWORDS = {
  shipment: ['продали', 'продал', 'продано', 'отгрузили', 'отгрузил', 'отправили', 'отправил', 'ушло', 'вышло'],
  receipt: ['получили', 'получил', 'приняли', 'принял', 'пришло', 'поступило', 'приехало', 'завезли'],
  transfer: ['передали', 'передал', 'переместили', 'переложили', 'перенесли'],
};

const DATE_KEYWORDS: Record<string, number> = {
  вчера: -1,
  позавчера: -2,
  сегодня: 0,
  'три дня назад': -3,
  'неделю назад': -7,
};

const UNIT_ALIASES: Record<string, string> = {
  г: 'г',
  гр: 'г',
  грамм: 'г',
  граммов: 'г',
  грамма: 'г',
  кг: 'кг',
  кило: 'кг',
  килограмм: 'кг',
  килограммов: 'кг',
  шт: 'шт',
  штук: 'шт',
  штуки: 'шт',
  штука: 'шт',
  уп: 'уп',
  упаковка: 'уп',
  упаковки: 'уп',
  упаковок: 'уп',
};

function resolveDate(text: string): number {
  const lower = text.toLowerCase();
  for (const [keyword, offset] of Object.entries(DATE_KEYWORDS)) {
    if (lower.includes(keyword)) {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      d.setHours(12, 0, 0, 0);
      return d.getTime();
    }
  }
  return Date.now();
}

function resolveOperation(text: string): VoiceCommand['type'] {
  const lower = text.toLowerCase();
  for (const [type, keywords] of Object.entries(OPERATION_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return type as VoiceCommand['type'];
  }
  return 'unknown';
}

function extractQty(text: string): { qty: number; unit: string } | null {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*([а-яё]+)/i);
  if (match) {
    const qty = parseFloat(match[1].replace(',', '.'));
    const unitRaw = match[2].toLowerCase();
    const unit = UNIT_ALIASES[unitRaw] ?? 'шт';
    return { qty, unit };
  }
  if (text.toLowerCase().includes('полкило')) return { qty: 500, unit: 'г' };
  if (text.toLowerCase().includes('полкилограмма')) return { qty: 500, unit: 'г' };
  return null;
}

async function findProduct(nameFragment: string): Promise<{ sku: string; name: string } | null> {
  const all = await getProductsForAct({ actType: 'shipment_b2b' });
  const q = nameFragment.toLowerCase();

  const exact = all.find((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  if (exact) return { sku: exact.id, name: exact.name };

  const qWords = q.split(/\s+/).filter((w) => w.length > 2);
  let best: (typeof all)[0] | null = null;
  let bestScore = 0;
  for (const p of all) {
    const pName = p.name.toLowerCase();
    const score = qWords.filter((w) => pName.includes(w)).length;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  if (best && bestScore >= 1) return { sku: best.id, name: best.name };
  return null;
}

export async function parseVoiceCommand(raw: string): Promise<VoiceCommand> {
  const type = resolveOperation(raw);
  const date = resolveDate(raw);
  const qtyResult = extractQty(raw);

  let fragment = raw.toLowerCase();
  [...Object.values(OPERATION_KEYWORDS).flat(), ...Object.keys(DATE_KEYWORDS)].forEach((kw) => {
    fragment = fragment.replace(kw, '');
  });
  fragment = fragment.replace(/\d+(?:[.,]\d+)?\s*([а-яё]+)/gi, '').trim();
  fragment = fragment.replace(/\b(и|на|за|с|по|от|в|из|к|у)\b/gi, '').trim();

  const product = fragment.length > 2 ? await findProduct(fragment) : null;

  const dateStr = new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const suggestion = [
    type !== 'unknown'
      ? type === 'shipment'
        ? 'Отгрузка'
        : type === 'receipt'
          ? 'Приёмка'
          : 'Передача'
      : '?',
    product ? `${product.name} (${product.sku})` : `товар не найден («${fragment}»)`,
    qtyResult ? `${qtyResult.qty} ${qtyResult.unit}` : 'кол-во не указано',
    `дата: ${dateStr}`,
  ].join(' · ');

  const confidence =
    (type !== 'unknown' ? 0.3 : 0) + (product ? 0.4 : 0) + (qtyResult ? 0.3 : 0);

  return {
    type,
    sku: product?.sku,
    productName: product?.name,
    qty: qtyResult?.qty,
    unit: qtyResult?.unit,
    date,
    confidence,
    raw,
    suggestion,
  };
}
