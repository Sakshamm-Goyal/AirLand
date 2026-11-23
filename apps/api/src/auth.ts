import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Role } from '@landconnect/shared';
import { hash, verify } from '@node-rs/argon2';
import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { jwtVerify, SignJWT } from 'jose';
import { config } from './config.ts';
import { db, schema } from './db/client.ts';
import { forbidden, HttpError } from './errors.ts';

const secret = new TextEncoder().encode(config.JWT_SECRET);
const ACCESS_TTL = '15m';
const REFRESH_TTL_MS = 30 * 24 * 3600 * 1000;

export interface AuthUser {
  id: string;
  role: Role;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser;
  }
}

// OWASP argon2id baseline: 19 MiB, t=2, p=1.
export const hashPassword = (pw: string) => hash(pw, { memoryCost: 19_456, timeCost: 2, parallelism: 1 });
export const verifyPassword = (digest: string, pw: string) => verify(digest, pw);

export const signAccess = (u: AuthUser) =>
  new SignJWT({ role: u.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(u.id)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secret);

export async function verifyAccess(token: string): Promise<AuthUser> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    return { id: String(payload.sub), role: payload.role as Role };
  } catch {
    throw new HttpError(401, 'Session expired');
  }
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export async function issueRefresh(userId: string, family: string = randomUUID()) {
  const token = randomBytes(32).toString('base64url');
  await db.insert(schema.refreshTokens).values({
    userId,
    family,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return token;
}

/** Rotate a refresh token. Reusing an already-rotated token revokes the whole family (theft detection). */
export async function rotateRefresh(token: string) {
  const [row] = await db
    .select()
    .from(schema.refreshTokens)
    .where(eq(schema.refreshTokens.tokenHash, sha256(token)));
  if (!row) throw new HttpError(401, 'Session expired');
  if (row.revokedAt) {
    await db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.refreshTokens.family, row.family), isNull(schema.refreshTokens.revokedAt)));
    throw new HttpError(401, 'Session expired');
  }
  if (row.expiresAt < new Date()) throw new HttpError(401, 'Session expired');
  await db.update(schema.refreshTokens).set({ revokedAt: new Date() }).where(eq(schema.refreshTokens.id, row.id));
  return { userId: row.userId, refreshToken: await issueRefresh(row.userId, row.family) };
}

export const revokeRefresh = (token: string) =>
  db
    .update(schema.refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(schema.refreshTokens.tokenHash, sha256(token)));

export async function authenticate(req: FastifyRequest, _reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Sign in required');
  req.user = await verifyAccess(header.slice(7));
}

/** Route guard: `preHandler: [authenticate, can('seller', 'broker')]`. */
export const can =
  (...roles: Role[]) =>
  async (req: FastifyRequest) => {
    if (!roles.includes(req.user.role)) throw forbidden(`Only ${roles.join(' or ')} accounts can do this`);
  };
