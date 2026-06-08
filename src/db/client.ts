import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!dbInstance) {
    const expo = SQLite.openDatabaseSync('srecha.db');
    dbInstance = drizzle(expo, { schema });
  }
  return dbInstance;
}

export type Database = ReturnType<typeof getDb>;
