import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const colors = {
  gold: '#C8A96E',
  background: '#0F0F0F',
  card: '#1A1A1A',
  foreground: '#F5F0E8',
  danger: '#E85D4A',
  success: '#5BA85F',
  muted: '#666666',
};
