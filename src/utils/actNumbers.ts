import { ActType, ACT_TYPE_PREFIX } from '@/src/types';
import { eq } from 'drizzle-orm';
import { getDb } from '@/src/db/client';
import { settings } from '@/src/db/schema';

export async function generateActNumber(
  type: ActType,
  deviceSuffix?: string
): Promise<string> {
  const db = getDb();
  const prefix = ACT_TYPE_PREFIX[type];
  const year = new Date().getFullYear();
  const counterKey = `counter_${type}_${year}`;

  const existing = await db
    .select()
    .from(settings)
    .where(eq(settings.key, counterKey))
    .limit(1);

  let counter = existing.length > 0 ? parseInt(existing[0].value, 10) : 0;
  counter += 1;

  if (existing.length > 0) {
    await db
      .update(settings)
      .set({ value: String(counter) })
      .where(eq(settings.key, counterKey));
  } else {
    await db.insert(settings).values({ key: counterKey, value: String(counter) });
  }

  const padded = String(counter).padStart(4, '0');
  const base = `${prefix}-${year}-${padded}`;
  return deviceSuffix ? `${base}-${deviceSuffix}` : base;
}

export function calcQtyDiff(
  qtyPlanned?: number | null,
  qtyActual?: number | null
): number | undefined {
  if (qtyPlanned == null && qtyActual == null) return undefined;
  return (qtyActual ?? 0) - (qtyPlanned ?? 0);
}

export function calcLineAmount(
  qtyActual?: number | null,
  priceUnit?: number | null
): number | undefined {
  if (qtyActual == null || priceUnit == null) return undefined;
  return Math.round(qtyActual * priceUnit * 100) / 100;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
