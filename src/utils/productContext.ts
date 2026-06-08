import type { ActType, WarehouseId } from '@/src/types';

export const TEA_CATEGORIES = [
  'Белый чай',
  'Зелёный чай',
  'Красный/Чёрный',
  'Улун',
  'Пу Эр',
  'Пу Эр Vintage',
  'Технологичный',
  'Less Tea',
] as const;

export const EQUIPMENT_CATEGORIES = [
  'Чайники',
  'Воронки',
  'Аксессуары',
  'Матча',
  'Посуда',
  'Расходники',
] as const;

export const ALL_CATEGORIES = [...TEA_CATEGORIES, ...EQUIPMENT_CATEGORIES, 'Прочее'];

export const ALL_CHANNELS = ['B2B Бар', 'B2C / B2B2C / E-com', 'B2B / B2C', 'internal'];

export const WAREHOUSES_ORDER: WarehouseId[] = ['WH-01', 'WH-02', 'WH-03', 'WH-04'];

export interface ProductQueryContext {
  actType: ActType;
  transferFrom?: WarehouseId;
  transferTo?: WarehouseId;
  packagingType?: string;
  channel?: string;
}

export type PriorityRule =
  | { type: 'channel'; value: string }
  | { type: 'packaging_contains'; value: string }
  | { type: 'category'; value: string }
  | { type: 'weight_lte'; value: number }
  | { type: 'weight_gte'; value: number }
  | { type: 'weight_eq'; value: number }
  | { type: 'is_material'; value: boolean }
  | { type: 'sku_starts_with'; value: string };

export interface ProductFilter {
  onlyMaterials?: boolean;
  excludeMaterials?: boolean;
  categories?: string[];
  channels?: string[];
  excludeCategories?: string[];
  priorityRules: PriorityRule[];
}

const teaRules: PriorityRule[] = TEA_CATEGORIES.map((c) => ({ type: 'category', value: c }));

function is210Packaging(packagingType?: string): boolean {
  return packagingType === 'tub_210' || packagingType === 'zip_210';
}

export function getProductFilter(ctx: ProductQueryContext): ProductFilter {
  const { actType, transferFrom, transferTo, packagingType, channel } = ctx;

  switch (actType) {
    case 'receipt':
      return {
        excludeMaterials: true,
        excludeCategories: [...EQUIPMENT_CATEGORIES],
        priorityRules: [...teaRules, { type: 'category', value: 'Прочее' }],
      };

    case 'transfer':
      if (transferFrom === 'WH-01' && transferTo === 'WH-03') {
        return {
          excludeMaterials: true,
          excludeCategories: [...EQUIPMENT_CATEGORIES],
          priorityRules: teaRules,
        };
      }
      if (transferFrom === 'WH-02' && transferTo === 'WH-03') {
        return {
          onlyMaterials: true,
          priorityRules: [{ type: 'sku_starts_with', value: 'PKG-' }],
        };
      }
      if (
        (transferFrom === 'WH-03' && transferTo === 'WH-04') ||
        (transferFrom === 'WH-03' && transferTo === 'WH-01')
      ) {
        return {
          excludeMaterials: true,
          excludeCategories: [...EQUIPMENT_CATEGORIES],
          priorityRules: teaRules,
        };
      }
      return { priorityRules: [] };

    case 'packaging_card':
      if (is210Packaging(packagingType)) {
        return {
          excludeMaterials: true,
          excludeCategories: [...EQUIPMENT_CATEGORIES],
          priorityRules: [
            { type: 'weight_eq', value: 210 },
            ...teaRules,
          ],
        };
      }
      if (packagingType === 'zip_28') {
        return {
          excludeMaterials: true,
          excludeCategories: [...EQUIPMENT_CATEGORIES],
          priorityRules: [
            { type: 'weight_eq', value: 28 },
            ...teaRules,
          ],
        };
      }
      return {
        excludeMaterials: true,
        excludeCategories: [...EQUIPMENT_CATEGORIES],
        priorityRules: teaRules,
      };

    case 'shipment_b2b':
      if (channel) {
        return {
          excludeMaterials: true,
          priorityRules: [
            { type: 'channel', value: channel },
          ],
        };
      }
      return {
        excludeMaterials: true,
        priorityRules: [
          { type: 'channel', value: 'B2B Бар' },
          { type: 'channel', value: 'B2B / B2C' },
        ],
      };

    case 'shipment_ecom':
      return {
        excludeMaterials: true,
        priorityRules: [
          { type: 'channel', value: 'B2C / B2B2C / E-com' },
          { type: 'channel', value: 'B2B / B2C' },
        ],
      };

    case 'writeoff_raw':
      return {
        excludeMaterials: true,
        excludeCategories: [...EQUIPMENT_CATEGORIES],
        priorityRules: teaRules,
      };

    case 'writeoff_pkg':
      return {
        onlyMaterials: true,
        priorityRules: [{ type: 'sku_starts_with', value: 'PKG-' }],
      };

    case 'inventory':
      return { priorityRules: [] };

    default:
      return { priorityRules: [] };
  }
}

export function calcPriority(
  product: {
    channel: string;
    packaging: string;
    category: string;
    weight_g?: number | null;
    is_material?: boolean | null;
    id: string;
    warehouse?: string;
  },
  rules: PriorityRule[]
): number {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    let match = false;
    switch (rule.type) {
      case 'channel':
        match = product.channel === rule.value;
        break;
      case 'packaging_contains':
        match = product.packaging.includes(rule.value);
        break;
      case 'category':
        match = product.category === rule.value;
        break;
      case 'weight_lte':
        match = (product.weight_g ?? 9999) <= rule.value;
        break;
      case 'weight_gte':
        match = (product.weight_g ?? 0) >= rule.value;
        break;
      case 'weight_eq':
        match = product.weight_g === rule.value;
        break;
      case 'is_material':
        match = (product.is_material ?? false) === rule.value;
        break;
      case 'sku_starts_with':
        match = product.id.startsWith(rule.value);
        break;
    }
    if (match) return i;
  }
  return rules.length;
}

export function warehouseSortIndex(warehouse: string): number {
  const idx = WAREHOUSES_ORDER.indexOf(warehouse as WarehouseId);
  return idx >= 0 ? idx : WAREHOUSES_ORDER.length;
}
