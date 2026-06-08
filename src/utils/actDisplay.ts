import type { ActType, ActStatus } from '@/src/types';

export const ACT_TYPE_ICONS: Record<string, string> = {
  receipt: '📥',
  transfer: '🔄',
  packaging_card: '📦',
  writeoff_raw: '📤',
  writeoff_pkg: '📤',
  shipment_b2b: '🚚',
  shipment_ecom: '🛒',
  inventory: '📋',
};

export const ACT_TYPE_ICON_BG: Record<string, string> = {
  receipt: 'bg-gold/10',
  transfer: 'bg-accent-blue/10',
  packaging_card: 'bg-success/10',
  shipment_b2b: 'bg-gold/10',
  shipment_ecom: 'bg-gold/10',
};

export const ACT_TYPE_SHORT: Record<ActType, string> = {
  receipt: 'Приёмка',
  transfer: 'Передача',
  packaging_card: 'Упаковка',
  writeoff_raw: 'Списание сырья',
  writeoff_pkg: 'Списание упаковки',
  shipment_b2b: 'Отгрузка B2B',
  shipment_ecom: 'E-commerce',
  inventory: 'Инвентаризация',
};

export function getActMeta(act: {
  type: string;
  warehouse_from?: string | null;
  warehouse_to?: string | null;
  packaging_type?: string | null;
  lineCount?: number;
}): string {
  const parts: string[] = [ACT_TYPE_SHORT[act.type as ActType] ?? act.type];

  if (act.type === 'transfer' && act.warehouse_from && act.warehouse_to) {
    parts[0] = `${act.warehouse_from} → ${act.warehouse_to}`;
  } else if (act.warehouse_to) {
    parts.push(act.warehouse_to);
  } else if (act.type === 'receipt') {
    parts.push('WH-01');
  } else if (act.type === 'packaging_card') {
    parts.push('WH-03');
    if (act.packaging_type === 'tub_210') parts.push('Тубус 210г');
    if (act.packaging_type === 'zip_210') parts.push('Зип-лок 210г');
    if (act.packaging_type === 'zip_28') parts.push('Зип-лок 28г');
  }

  if (act.lineCount != null) {
    parts.push(`${act.lineCount} позиций`);
  }

  return parts.join(' · ');
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export const STATUS_STYLES: Record<
  ActStatus,
  { label: string; container: string; text: string }
> = {
  draft: {
    label: 'Черновик',
    container: 'bg-[#88888818] border border-[#88888844]',
    text: 'text-[#888]',
  },
  active: {
    label: 'Активен',
    container: 'bg-[#378ADD22] border border-[#378ADD44]',
    text: 'text-[#378ADD]',
  },
  closed: {
    label: 'Закрыт',
    container: 'bg-[#5BA85F22] border border-[#5BA85F44]',
    text: 'text-[#5BA85F]',
  },
};

export const TYPE_OPTIONS: {
  type: ActType;
  emoji: string;
  name: string;
  desc: string;
}[] = [
  { type: 'receipt', emoji: '📥', name: 'АП', desc: 'Акт приёмки товара от поставщика' },
  { type: 'transfer', emoji: '🔄', name: 'АТ', desc: 'Передача между складами' },
  { type: 'packaging_card', emoji: '📦', name: 'КУ', desc: 'Карта упаковки партии' },
  { type: 'shipment_b2b', emoji: '🚚', name: 'АО', desc: 'Отгрузка B2B / B2B2C' },
];
