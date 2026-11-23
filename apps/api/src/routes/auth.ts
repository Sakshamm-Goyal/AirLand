import {
  type AuthResponse,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  resetPasswordSchema,
  signUpSchema,
  updateMeSchema,
  verifyEmailSchema,
} from '@landconnect/shared';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate, hashPassword, issueRefresh, revokeRefresh, rotateRefresh, signAccess, verifyPassword } from '../auth.ts';
import { config } from '../config.ts';
import { db, schema } from '../db/client.ts';
import { toMe, toPublicUser } from '../dto.ts';
import { consumeCode, sendCode } from '../email-codes.ts';
import { HttpError, notFound } from '../errors.ts';

const { users, blocks, refreshTokens } = schema;
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
    // Best effort: the account works without it, and the app offers "Resend code".
    await sendCode(user, 'verify_email').catch((e) => req.log.warn({ err: e }, 'verification email not sent'));
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

  // ── Email codes ───────────────────────────────────────────────────────
  app.post('/auth/email/code', { ...strict, preHandler: authenticate }, async (req, reply) => {
    const [user] = await db.select().from(users).where(eq(users.id, req.user.id));
    if (!user) throw notFound();
    if (user.emailVerifiedAt) throw new HttpError(409, 'Your email is already verified');
    await sendCode(user, 'verify_email');
    return reply.code(204).send();
  });

  app.post('/auth/email/verify', { ...strict, preHandler: authenticate, schema: { body: verifyEmailSchema } }, async (req) => {
    await consumeCode(req.user.id, 'verify_email', req.body.code);
    const [user] = await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, req.user.id)).returning();
    if (!user) throw notFound();
    return toMe(user);
  });

  app.post('/auth/password/forgot', { ...strict, schema: { body: forgotPasswordSchema } }, async (req, reply) => {
    const [user] = await db.select().from(users).where(eq(users.email, req.body.email));
    // Same answer whether or not the account exists, so this can't be used to find out who's registered.
    if (user) {
      await sendCode(user, 'reset_password').catch((e) => {
        if (!(e instanceof HttpError && e.statusCode === 429)) throw e;
      });
    }
    return reply.code(204).send();
  });

  app.post('/auth/password/reset', { ...strict, schema: { body: resetPasswordSchema } }, async (req) => {
    const b = req.body;
    const [found] = await db.select().from(users).where(eq(users.email, b.email));
    if (!found) throw new HttpError(400, 'This code has expired. Ask for a new one.');
    await consumeCode(found.id, 'reset_password', b.code);
    // The code proved they own the address, so it counts as verified too.
    const [user] = await db
      .update(users)
      .set({ passwordHash: await hashPassword(b.password), emailVerifiedAt: found.emailVerifiedAt ?? new Date() })
      .where(eq(users.id, found.id))
      .returning();
    // Sign out every other device: whoever knew the old password loses access.
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, found.id), isNull(refreshTokens.revokedAt)));
    return session(user!);
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
