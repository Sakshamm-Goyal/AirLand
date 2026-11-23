import { type Listing, listingInputSchema, listingQuerySchema, type Page, toSqft } from '@landconnect/shared';
import { and, between, desc, eq, gte, ilike, lte, or, type SQL, sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate, can } from '../auth.ts';
import { db, schema } from '../db/client.ts';
import { toListing } from '../dto.ts';
import { notFound } from '../errors.ts';

const { listings, users, savedListings } = schema;
const params = z.object({ id: z.uuid() });
const patchSchema = listingInputSchema.partial().extend({ status: z.enum(['active', 'sold']).optional() });

const encodeCursor = (l: { createdAt: Date; id: string }) => Buffer.from(`${l.createdAt.toISOString()}|${l.id}`).toString('base64url');
const decodeCursor = (c: string) => {
  const [at, id] = Buffer.from(c, 'base64url').toString().split('|');
  return { at: new Date(at ?? 0), id: id ?? '' };
};

/** Base select: listing + owner + whether the viewer saved it. */
const selectListings = (viewerId: string) =>
  db
    .select({ l: listings, owner: users, saved: sql<boolean>`${savedListings.userId} is not null` })
    .from(listings)
    .innerJoin(users, eq(users.id, listings.ownerId))
    .leftJoin(savedListings, and(eq(savedListings.listingId, listings.id), eq(savedListings.userId, viewerId)))
    .$dynamic();

export const listingRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', authenticate);

  app.get('/listings', { schema: { querystring: listingQuerySchema } }, async (req): Promise<Page<Listing>> => {
    const q = req.query;
    const where: (SQL | undefined)[] = [q.owner === 'me' ? eq(listings.ownerId, req.user.id) : eq(listings.status, 'active')];
    if (q.type) where.push(eq(listings.landType, q.type));
    if (q.minPrice != null) where.push(gte(listings.priceInr, q.minPrice));
    if (q.maxPrice != null) where.push(lte(listings.priceInr, q.maxPrice));
    if (q.q) {
      const like = `%${q.q.replace(/[%_]/g, '\\$&')}%`;
      where.push(or(ilike(listings.title, like), ilike(listings.locality, like), ilike(listings.district, like)));
    }
    if (q.bbox) {
      const [minLng, minLat, maxLng, maxLat] = q.bbox.split(',').map(Number) as [number, number, number, number];
      where.push(between(listings.lng, minLng, maxLng), between(listings.lat, minLat, maxLat));
    }
    if (q.cursor) {
      const c = decodeCursor(q.cursor);
      where.push(sql`(${listings.createdAt}, ${listings.id}) < (${c.at.toISOString()}::timestamptz, ${c.id}::uuid)`);
    }
    // Map viewport requests want everything visible, not a page.
    const limit = q.bbox ? 200 : q.limit;
    const rows = await selectListings(req.user.id)
      .where(and(...where))
      .orderBy(desc(listings.createdAt), desc(listings.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map((r) => toListing(r.l, r.owner, req.user.id, r.saved)),
      nextCursor: rows.length > limit && last ? encodeCursor(last.l) : null,
    };
  });

  app.get('/listings/:id', { schema: { params } }, async (req) => {
    const [r] = await selectListings(req.user.id).where(eq(listings.id, req.params.id));
    if (!r) throw notFound('Listing not found');
    return toListing(r.l, r.owner, req.user.id, r.saved);
  });

  app.post('/listings', { preHandler: can('seller', 'broker'), schema: { body: listingInputSchema } }, async (req, reply) => {
    const b = req.body;
    const [l] = await db
      .insert(listings)
      .values({ ...b, ownerId: req.user.id, areaSqft: toSqft(b.area, b.areaUnit) })
      .returning();
    const [owner] = await db.select().from(users).where(eq(users.id, req.user.id));
    reply.code(201);
    return toListing(l!, owner!, req.user.id);
  });

  // Ownership lives in the WHERE clause: someone else's id matches 0 rows → 404, no separate check to forget.
  app.patch('/listings/:id', { schema: { params, body: patchSchema } }, async (req) => {
    const b = req.body;
    const [current] = await db
      .select()
      .from(listings)
      .where(and(eq(listings.id, req.params.id), eq(listings.ownerId, req.user.id)));
    if (!current) throw notFound('Listing not found');
    const area = b.area ?? current.area;
    const unit = b.areaUnit ?? current.areaUnit;
    const [l] = await db
      .update(listings)
      .set({ ...b, areaSqft: toSqft(area, unit), updatedAt: new Date() })
      .where(and(eq(listings.id, req.params.id), eq(listings.ownerId, req.user.id)))
      .returning();
    const [owner] = await db.select().from(users).where(eq(users.id, req.user.id));
    return toListing(l!, owner!, req.user.id);
  });

  app.delete('/listings/:id', { schema: { params } }, async (req, reply) => {
    const gone = await db
      .delete(listings)
      .where(and(eq(listings.id, req.params.id), eq(listings.ownerId, req.user.id)))
      .returning({ id: listings.id });
    if (!gone.length) throw notFound('Listing not found');
    return reply.code(204).send();
  });

  app.put('/listings/:id/save', { schema: { params } }, async (req, reply) => {
    await db.insert(savedListings).values({ userId: req.user.id, listingId: req.params.id }).onConflictDoNothing();
    return reply.code(204).send();
  });
  app.delete('/listings/:id/save', { schema: { params } }, async (req, reply) => {
    await db.delete(savedListings).where(and(eq(savedListings.userId, req.user.id), eq(savedListings.listingId, req.params.id)));
    return reply.code(204).send();
  });
};
