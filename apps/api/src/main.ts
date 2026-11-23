import { buildApp } from './app.ts';
import { config } from './config.ts';
import { sql } from './db/client.ts';

const app = await buildApp();
await app.listen({ port: config.PORT, host: config.HOST });

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.once(sig, async () => {
    await app.close();
    await sql.end({ timeout: 5 });
    process.exit(0);
  });
}
