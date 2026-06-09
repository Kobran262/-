export type UserRole = 'admin' | 'cto' | 'manager' | 'warehouse';

export type WarehouseId = 'WH-01' | 'WH-02' | 'WH-03' | 'WH-04';

export interface User {
  id: string;
  name: string;
  full_name?: string;
  role: UserRole;
  warehouse_default?: WarehouseId;
  created_at: number;
  updated_at: number;
}

export type ActType =
  | 'receipt'
  | 'transfer'
  | 'packaging_card'
  | 'writeoff_raw'
  | 'writeoff_pkg'
  | 'shipment_b2b'
  | 'shipment_ecom'
  | 'inventory';

export type ActStatus = 'draft' | 'active' | 'closed';

export interface Act {
  id: string;
  number: string;
  type: ActType;
  status: ActStatus;
  date: number;
  date_closed?: number;
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
  wc_order_id?: string;
  notes?: string;
  pdf_path?: string;
  gdrive_id?: string;
  created_at: number;
  updated_at: number;
  device_id: string;
  sync_pending?: boolean;
}

export interface ActLine {
  id: string;
  act_id: string;
  line_number: number;
  sku: string;
  product_name: string;
  category?: string;
  unit: string;
  qty_planned?: number;
  qty_actual?: number;
  qty_diff?: number;
  price_unit?: number;
  amount?: number;
  condition?: string;
  norm_per_unit?: number;
  notes?: string;
  updated_at: number;
}

export interface Product {
  id: string;
  name: string;
  name_ru?: string;
  category: string;
  channel: string;
  packaging: string;
  weight_g?: number;
  price_rrp?: number;
  price_opt?: number;
  price_opt_no_vat?: number;
  vat_amount?: number;
  discount_pct?: number;
  warehouse: string;
  barcode?: string;
  is_material?: boolean;
  is_active?: boolean;
  notes?: string;
  updated_at: number;
  sync_pending?: boolean;
}

export interface Movement {
  id: string;
  date: number;
  act_id: string;
  act_number: string;
  operation_type: string;
  warehouse_from?: string;
  warehouse_to?: string;
  sku: string;
  product_name: string;
  unit: string;
  qty_in?: number;
  qty_out?: number;
  responsible?: string;
  channel?: string;
  status?: string;
  notes?: string;
  created_at: number;
  device_id: string;
  sync_pending?: boolean;
}

export const ACT_TYPE_LABELS: Record<ActType, string> = {
  receipt: 'Акт приёмки (АП)',
  transfer: 'Акт передачи (АТ)',
  packaging_card: 'Карта упаковки (КУ)',
  writeoff_raw: 'Списание сырья (АСС)',
  writeoff_pkg: 'Списание упаковки (АСУ)',
  shipment_b2b: 'Отгрузка B2B (АО)',
  shipment_ecom: 'Заказ E-commerce (ЭО)',
  inventory: 'Инвентаризация (ИВ)',
};

export const ACT_TYPE_PREFIX: Record<ActType, string> = {
  receipt: 'АП',
  transfer: 'АТ',
  packaging_card: 'КУ',
  writeoff_raw: 'АСС',
  writeoff_pkg: 'АСУ',
  shipment_b2b: 'АО',
  shipment_ecom: 'ЭО',
  inventory: 'ИВ',
};

export const WAREHOUSES: Record<WarehouseId, string> = {
  'WH-01': 'Склад сырья и приёмки',
  'WH-02': 'Упаковочные материалы',
  'WH-03': 'Производство / упаковка',
  'WH-04': 'Готовая продукция',
};

export const TRANSFER_ROUTES: Record<WarehouseId, WarehouseId[]> = {
  'WH-01': ['WH-02', 'WH-03'],
  'WH-02': ['WH-03'],
  'WH-03': ['WH-01', 'WH-04'],
  'WH-04': [],
};
