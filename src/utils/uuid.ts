import { randomUUID } from 'expo-crypto';

/** UUID v4 compatible with React Native (no global `crypto` required). */
export function uuidv4(): string {
  return randomUUID();
}
