import { getDb } from './client';

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  warehouse_default TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  name_ru TEXT,
  category TEXT NOT NULL,
  channel TEXT NOT NULL,
  packaging TEXT NOT NULL,
  weight_g REAL,
  price_rrp REAL,
  price_opt REAL,
  price_opt_no_vat REAL,
  vat_amount REAL,
  discount_pct REAL,
  warehouse TEXT NOT NULL,
  barcode TEXT,
  is_material INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  notes TEXT,
  updated_at INTEGER NOT NULL,
  sync_pending INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS acts (
  id TEXT PRIMARY KEY NOT NULL,
  number TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  date INTEGER NOT NULL,
  date_closed INTEGER,
  warehouse_from TEXT,
  warehouse_to TEXT,
  supplier TEXT,
  invoice_number TEXT,
  client_name TEXT,
  client_contact TEXT,
  client_address TEXT,
  channel TEXT,
  responsible_user TEXT,
  checked_by TEXT,
  packaging_type TEXT,
  sku_finished TEXT,
  wc_order_id TEXT,
  notes TEXT,
  pdf_path TEXT,
  gdrive_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  device_id TEXT NOT NULL,
  sync_pending INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS act_lines (
  id TEXT PRIMARY KEY NOT NULL,
  act_id TEXT NOT NULL,
  line_number INTEGER NOT NULL,
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT,
  unit TEXT NOT NULL,
  qty_planned REAL,
  qty_actual REAL,
  qty_diff REAL,
  price_unit REAL,
  amount REAL,
  condition TEXT,
  norm_per_unit REAL,
  notes TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS movements (
  id TEXT PRIMARY KEY NOT NULL,
  date INTEGER NOT NULL,
  act_id TEXT NOT NULL,
  act_number TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  warehouse_from TEXT,
  warehouse_to TEXT,
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  qty_in REAL,
  qty_out REAL,
  responsible TEXT,
  channel TEXT,
  status TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  device_id TEXT NOT NULL,
  sync_pending INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inventory_acts (
  id TEXT PRIMARY KEY NOT NULL,
  number TEXT NOT NULL,
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  date_start INTEGER NOT NULL,
  date_end INTEGER,
  commission TEXT,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  device_id TEXT NOT NULL,
  sync_pending INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inventory_lines (
  id TEXT PRIMARY KEY NOT NULL,
  inventory_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  warehouse TEXT NOT NULL,
  unit TEXT NOT NULL,
  qty_accounting REAL,
  qty_actual REAL,
  qty_diff REAL,
  diff_pct REAL,
  reason TEXT,
  correction REAL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

export async function runMigrations(): Promise<void> {
  const db = getDb();
  const statements = MIGRATION_SQL.split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await db.$client.execAsync(`${statement};`);
  }

  const alterStatements = [
    'ALTER TABLE inventory_lines ADD COLUMN manually_entered INTEGER DEFAULT 0',
    'ALTER TABLE inventory_acts ADD COLUMN pdf_path TEXT',
    'ALTER TABLE inventory_acts ADD COLUMN gdrive_id TEXT',
    'ALTER TABLE users ADD COLUMN full_name TEXT',
  ];

  for (const statement of alterStatements) {
    try {
      await db.$client.execAsync(`${statement};`);
    } catch {
      // column already exists
    }
  }
}
