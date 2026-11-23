import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/** Fresh test database per run: drop, create, migrate. */
export default async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL ?? 'postgres://lc:lc@localhost:5433/landconnect_test');
  const name = url.pathname.slice(1);
  const admin = postgres({
    ...Object.fromEntries([
      ['host', url.hostname],
      ['port', Number(url.port)],
      ['username', url.username],
      ['password', url.password],
    ]),
    database: 'postgres',
    onnotice: () => {},
  });
  await admin.unsafe(`drop database if exists "${name}" with (force)`);
  await admin.unsafe(`create database "${name}"`);
  await admin.end();
  const sql = postgres(url.toString(), { onnotice: () => {} });
  await migrate(drizzle(sql), { migrationsFolder: new URL('../drizzle', import.meta.url).pathname });
  await sql.end();
}
