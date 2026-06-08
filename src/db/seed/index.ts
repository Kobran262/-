import { count } from 'drizzle-orm';
import { getDb } from '../client';
import { products, settings, users } from '../schema';
import { WAREHOUSES } from '../../types';
import { hashPin } from '../../utils/validation';
import { INITIAL_MATERIALS } from './materials';
import { INITIAL_PRODUCTS, type SeedProduct } from './products';

const ACT_COUNTER_TYPES = [
  'receipt',
  'transfer',
  'packaging_card',
  'writeoff_raw',
  'writeoff_pkg',
  'shipment_b2b',
  'shipment_ecom',
  'inventory',
] as const;

const DEFAULT_USERS = [
  { id: 'user-admin', name: 'Админ', role: 'admin', warehouse_default: 'WH-04' },
  { id: 'user-ivan', name: 'Иван И.', role: 'warehouse', warehouse_default: 'WH-01' },
  { id: 'user-maria', name: 'Мария П.', role: 'warehouse', warehouse_default: 'WH-03' },
  { id: 'user-petar', name: 'Петар К.', role: 'warehouse', warehouse_default: 'WH-04' },
] as const;

function toProductRow(seed: SeedProduct, updatedAt: number) {
  return {
    id: seed.id,
    name: seed.name,
    name_ru: seed.name_ru ?? null,
    category: seed.category,
    channel: seed.channel,
    packaging: seed.packaging,
    weight_g: seed.weight_g ?? null,
    price_rrp: seed.price_rrp ?? null,
    price_opt: seed.price_opt ?? null,
    price_opt_no_vat: seed.price_opt_no_vat ?? null,
    vat_amount: seed.vat_amount ?? null,
    discount_pct: seed.discount_pct ?? null,
    warehouse: seed.warehouse,
    barcode: seed.barcode ?? null,
    is_material: seed.is_material ?? false,
    is_active: seed.is_active ?? true,
    notes: seed.notes ?? null,
    updated_at: updatedAt,
  };
}

export async function seedDatabase(): Promise<void> {
  const db = getDb();
  const now = Date.now();

  const [result] = await db.select({ value: count() }).from(products);
  if ((result?.value ?? 0) > 0) {
    return;
  }

  const allSeeds = [...INITIAL_PRODUCTS, ...INITIAL_MATERIALS];
  await db.insert(products).values(allSeeds.map((seed) => toProductRow(seed, now)));

  const defaultPinHash = await hashPin('1234');

  await db.insert(users).values(
    DEFAULT_USERS.map((user) => ({
      id: user.id,
      name: user.name,
      role: user.role,
      pin_hash: defaultPinHash,
      warehouse_default: user.warehouse_default,
      created_at: now,
      updated_at: now,
    })),
  );

  const settingsRows = [
    { key: 'warehouses', value: JSON.stringify(WAREHOUSES) },
    { key: 'counter_year', value: String(new Date().getFullYear()) },
    ...ACT_COUNTER_TYPES.map((type) => ({
      key: `counter_${type}`,
      value: '0',
    })),
  ];

  await db.insert(settings).values(settingsRows);
}
