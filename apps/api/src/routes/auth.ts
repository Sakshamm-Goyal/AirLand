import { type AuthResponse, loginSchema, refreshSchema, signUpSchema, updateMeSchema } from '@landconnect/shared';
import { and, desc, eq } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate, hashPassword, issueRefresh, revokeRefresh, rotateRefresh, signAccess, verifyPassword } from '../auth.ts';
import { config } from '../config.ts';
import { db, schema } from '../db/client.ts';
import { toMe, toPublicUser } from '../dto.ts';
import { HttpError, notFound } from '../errors.ts';

const { users, blocks } = schema;
// Brute-force guard on credential endpoints (per IP).
const strict = { config: { rateLimit: { max: config.NODE_ENV === 'test' ? 10_000 : 10, timeWindow: '1 minute' } } };

async function session(user: typeof users.$inferSelect): Promise<AuthResponse> {
  return {
    user: toMe(user),
    accessToken: await signAccess(user),
    refreshToken: await issueRefresh(user.id),
  };
}

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/auth/signup', { ...strict, schema: { body: signUpSchema } }, async (req, reply) => {
    const b = req.body;
    const [user] = await db
      .insert(users)
      .values({
        name: b.name,
        email: b.email,
        role: b.role,
        phone: b.phone ?? null,
        reraId: b.role === 'broker' ? (b.reraId ?? null) : null,
        passwordHash: await hashPassword(b.password),
      })
      .onConflictDoNothing({ target: users.email })
      .returning();
    if (!user) throw new HttpError(409, 'An account with this email already exists');
    reply.code(201);
    return session(user);
  });

  app.post('/auth/login', { ...strict, schema: { body: loginSchema } }, async (req) => {
    const [user] = await db.select().from(users).where(eq(users.email, req.body.email));
    // Same message for both cases so the endpoint doesn't reveal which emails exist.
    if (!user || !(await verifyPassword(user.passwordHash, req.body.password))) {
      throw new HttpError(401, 'Wrong email or password');
    }
    return session(user);
  });

  app.post('/auth/refresh', { ...strict, schema: { body: refreshSchema } }, async (req) => {
    const { userId, refreshToken } = await rotateRefresh(req.body.refreshToken);
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new HttpError(401, 'Session expired');
    return { user: toMe(user), accessToken: await signAccess(user), refreshToken } satisfies AuthResponse;
  });

  app.post('/auth/logout', { schema: { body: refreshSchema } }, async (req, reply) => {
    await revokeRefresh(req.body.refreshToken);
    return reply.code(204).send();
  });

  app.get('/me', { preHandler: authenticate }, async (req) => {
    const [user] = await db.select().from(users).where(eq(users.id, req.user.id));
    if (!user) throw notFound();
    return toMe(user);
  });

  app.patch('/me', { preHandler: authenticate, schema: { body: updateMeSchema } }, async (req) => {
    const [user] = await db.update(users).set(req.body).where(eq(users.id, req.user.id)).returning();
    if (!user) throw notFound();
    return toMe(user);
  });

  app.get('/me/blocks', { preHandler: authenticate }, async (req) => {
    const rows = await db
      .select({ u: users })
      .from(blocks)
      .innerJoin(users, eq(users.id, blocks.blockedId))
      .where(eq(blocks.blockerId, req.user.id))
      .orderBy(desc(blocks.createdAt));
    return rows.map((r) => toPublicUser(r.u));
  });

  const userParams = z.object({ id: z.uuid() });
  app.post('/users/:id/block', { preHandler: authenticate, schema: { params: userParams } }, async (req, reply) => {
    if (req.params.id === req.user.id) throw new HttpError(400, "You can't block yourself");
    await db.insert(blocks).values({ blockerId: req.user.id, blockedId: req.params.id }).onConflictDoNothing();
    return reply.code(204).send();
  });
  app.delete('/users/:id/block', { preHandler: authenticate, schema: { params: userParams } }, async (req, reply) => {
    await db.delete(blocks).where(and(eq(blocks.blockerId, req.user.id), eq(blocks.blockedId, req.params.id)));
    return reply.code(204).send();
  });
};
