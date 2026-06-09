import { z } from 'zod';
import * as Crypto from 'expo-crypto';

export const receiptActSchema = z.object({
  date: z.number(),
  supplier: z.string().min(1, 'Укажите поставщика'),
  invoice_number: z.string().min(1, 'Укажите номер инвойса'),
  responsible_user: z.string().min(1, 'Укажите ответственного'),
  checked_by: z.string().optional(),
  notes: z.string().optional(),
});

export const transferActSchema = z.object({
  date: z.number(),
  warehouse_from: z.string().min(1),
  warehouse_to: z.string().min(1),
  responsible_user: z.string().min(1),
  checked_by: z.string().optional(),
  notes: z.string().optional(),
});

export const packagingActSchema = z.object({
  date: z.number(),
  packaging_type: z.string().min(1),
  sku_finished: z.string().min(1, 'Укажите SKU готовой продукции'),
  responsible_user: z.string().min(1),
  notes: z.string().optional(),
});

export const shipmentActSchema = z.object({
  date: z.number(),
  channel: z.string().min(1, 'Укажите канал продаж'),
  client_name: z.string().min(1, 'Укажите клиента'),
  client_contact: z.string().optional(),
  client_address: z.string().optional(),
  invoice_number: z.string().optional(),
  responsible_user: z.string().min(1),
  notes: z.string().optional(),
});

export const actLineSchema = z.object({
  sku: z.string().min(1),
  product_name: z.string().min(1),
  unit: z.string().min(1),
  qty_planned: z.number().optional(),
  qty_actual: z.number().optional(),
  price_unit: z.number().optional(),
  condition: z.string().optional(),
  notes: z.string().optional(),
});

export const pinSchema = z
  .string()
  .length(4, 'PIN должен содержать 4 цифры')
  .regex(/^\d{4}$/, 'Только цифры');

const PIN_SALT = 'srecha_wms_2025';

function legacyHashPin(pin: string): string {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    hash = (hash << 5) - hash + pin.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

export async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin + PIN_SALT);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const computed = await hashPin(pin);
  if (computed === hash) return true;
  return legacyHashPin(pin) === hash;
}
