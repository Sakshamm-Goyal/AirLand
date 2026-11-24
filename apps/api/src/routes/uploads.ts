import { and, count, eq, gt } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../auth.ts';
import { config } from '../config.ts';
import { db, schema } from '../db/client.ts';
import { HttpError, notFound } from '../errors.ts';

const MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
const DAILY_LIMIT = 100; // 10 photos × 10 listings a day; photos live in Postgres, so this also caps storage growth

/** What the bytes actually are. The client's Content-Type is just a claim. */
export function sniff(b: Buffer): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (b.length >= 12 && b.toString('ascii', 4, 8) === 'ftyp' && /^(heic|heix|heim|heis|mif1|msf1)$/.test(b.toString('ascii', 8, 12)))
    return 'image/heic';
  return null;
}

export const uploadRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/uploads', { preHandler: authenticate }, async (req, reply) => {
    const [today] = await db
      .select({ n: count() })
      .from(schema.uploads)
      .where(and(eq(schema.uploads.ownerId, req.user.id), gt(schema.uploads.createdAt, new Date(Date.now() - 86_400_000))));
    if ((today?.n ?? 0) >= DAILY_LIMIT) throw new HttpError(429, `You can upload up to ${DAILY_LIMIT} photos a day. Try again tomorrow.`);
    const file = await req.file({ limits: { fileSize: 4 * 1024 * 1024, files: 1 } });
    if (!file) throw new HttpError(400, 'No file');
    if (!MIME.has(file.mimetype)) throw new HttpError(415, 'Only JPEG, PNG, WebP or HEIC photos');
    const bytes = await file.toBuffer(); // throws 413 past the limit
    const mime = sniff(bytes);
    if (!mime) throw new HttpError(415, "That file isn't a photo");
    const [row] = await db.insert(schema.uploads).values({ ownerId: req.user.id, mime, bytes }).returning({ id: schema.uploads.id });
    reply.code(201);
    return { url: `${config.PUBLIC_URL}/uploads/${row!.id}` };
  });

  app.get('/uploads/:id', { schema: { params: z.object({ id: z.uuid() }) } }, async (req, reply) => {
    const [row] = await db
      .select({ mime: schema.uploads.mime, bytes: schema.uploads.bytes })
      .from(schema.uploads)
      .where(eq(schema.uploads.id, req.params.id));
    if (!row) throw notFound();
    // Content-addressed by id and never mutated → cache forever on device and any CDN.
    return reply.header('cache-control', 'public, max-age=31536000, immutable').type(row.mime).send(row.bytes);
  });
};
