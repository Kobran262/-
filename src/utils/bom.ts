export interface BOMMaterial {
  sku: string;
  name: string;
  qty_per_unit: number;
}

export interface PackagingBOM {
  name: string;
  raw_tea_g: number;
  materials: BOMMaterial[];
}

export interface BOMCalculation {
  raw_tea: { sku: string; qty_plan_g: number };
  materials: Array<BOMMaterial & { qty_plan: number }>;
}

export const BOM: Record<string, PackagingBOM> = {
  tub_210: {
    name: 'B2B Тубус 210г',
    raw_tea_g: 210,
    materials: [
      { sku: 'PKG-TUB-BLK', name: 'Тубус чёрный (корпус)', qty_per_unit: 1 },
      { sku: 'PKG-TUB-LID', name: 'Крышка верхняя тубуса', qty_per_unit: 1 },
      { sku: 'PKG-TUB-BOT', name: 'Крышка-дно тубуса', qty_per_unit: 1 },
      { sku: 'PKG-STK-TUB', name: 'Стикер общий для тубуса', qty_per_unit: 1 },
      { sku: 'PKG-STK-TYPE', name: 'Стикер тип чая (круглый)', qty_per_unit: 1 },
      { sku: 'PKG-STK-VAR', name: 'Стикер описание сорта', qty_per_unit: 1 },
      { sku: 'PKG-BAG-7G', name: 'Пакетик порционный 7г', qty_per_unit: 30 },
    ],
  },
  zip_210: {
    name: 'B2B Зип-лок 210г',
    raw_tea_g: 210,
    materials: [
      { sku: 'PKG-ZIP-210', name: 'Зип-лок пакет 210г', qty_per_unit: 1 },
      { sku: 'PKG-STK-TYPE', name: 'Стикер тип чая (круглый)', qty_per_unit: 1 },
      { sku: 'PKG-STK-VAR', name: 'Стикер описание сорта', qty_per_unit: 1 },
    ],
  },
  zip_28: {
    name: 'B2C / B2B2C / E-com Зип-лок 28г',
    raw_tea_g: 28,
    materials: [
      { sku: 'PKG-ZIP-28', name: 'Зип-лок пакет 28г', qty_per_unit: 1 },
      { sku: 'PKG-STK-TYPE', name: 'Стикер тип чая (круглый)', qty_per_unit: 1 },
      { sku: 'PKG-STK-VAR', name: 'Стикер описание сорта', qty_per_unit: 1 },
    ],
  },
};

export function calculateBOMPlan(
  packaging_type: string,
  qty_units: number,
  raw_tea_sku: string
): BOMCalculation {
  const bom = BOM[packaging_type];
  if (!bom) {
    throw new Error(`Unknown packaging type: ${packaging_type}`);
  }
  return {
    raw_tea: { sku: raw_tea_sku, qty_plan_g: bom.raw_tea_g * qty_units },
    materials: bom.materials.map((m) => ({
      ...m,
      qty_plan: m.qty_per_unit * qty_units,
    })),
  };
}

export const PACKAGING_TYPE_OPTIONS = [
  { id: 'tub_210', label: 'Тубус 210г' },
  { id: 'zip_210', label: 'Зип-лок 210г' },
  { id: 'zip_28', label: 'Зип-лок 28г' },
] as const;
