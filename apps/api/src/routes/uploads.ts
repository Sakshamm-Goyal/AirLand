import { eq } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../auth.ts';
import { config } from '../config.ts';
import { db, schema } from '../db/client.ts';
import { HttpError, notFound } from '../errors.ts';

const MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

export const uploadRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/uploads', { preHandler: authenticate }, async (req, reply) => {
    const file = await req.file({ limits: { fileSize: 4 * 1024 * 1024, files: 1 } });
    if (!file) throw new HttpError(400, 'No file');
    if (!MIME.has(file.mimetype)) throw new HttpError(415, 'Only JPEG, PNG, WebP or HEIC photos');
    const bytes = await file.toBuffer(); // throws 413 past the limit
    const [row] = await db
      .insert(schema.uploads)
      .values({ ownerId: req.user.id, mime: file.mimetype, bytes })
      .returning({ id: schema.uploads.id });
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
