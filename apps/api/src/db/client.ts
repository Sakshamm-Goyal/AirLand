import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config.ts';
import * as schema from './schema.ts';

// ponytail: one pool for the process; size it to the DB plan (Supabase free ≈ 60 conns via pooler).
export const sql = postgres(config.DATABASE_URL, { max: 10, prepare: !config.DATABASE_URL.includes('pooler') });
export const db = drizzle(sql, { schema, casing: 'snake_case' });
export type Db = typeof db;
export { schema };
