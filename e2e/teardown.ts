import postgres from 'postgres';

/**
 * Removes every account the suite created (emails end in @e2e.test); their listings, chats and calls cascade.
 * Keeps the dev feed showing seed data only. Point E2E_DATABASE_URL at the API's database.
 */
export default async function teardown() {
  const sql = postgres(process.env.E2E_DATABASE_URL ?? 'postgres://lc:lc@localhost:5433/landconnect', { onnotice: () => {} });
  try {
    await sql`delete from users where email like '%@e2e.test'`;
  } finally {
    await sql.end();
  }
}
