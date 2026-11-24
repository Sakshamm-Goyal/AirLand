import { createHmac, randomInt } from 'node:crypto';
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { config } from './config.ts';
import { db, schema } from './db/client.ts';
import { HttpError } from './errors.ts';
import { codeEmail } from './mail-template.ts';

const { emailCodes } = schema;
type Purpose = (typeof schema.codePurposeEnum.enumValues)[number];

const TTL_MIN = 10;
const MAX_TRIES = 5;
const COOLDOWN_S = 30;

// ── Mail ─────────────────────────────────────────────────────────────────
export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}
/** Tests read codes from here instead of a mailbox. */
export const outbox: Mail[] = [];

const smtpUrl = config.SMTP_URL ?? (config.NODE_ENV === 'development' ? 'smtp://localhost:1025' : undefined);
const transport = smtpUrl ? nodemailer.createTransport(smtpUrl) : null;

async function sendMail(m: Mail) {
  if (config.NODE_ENV === 'test') {
    outbox.push(m);
    return;
  }
  if (!transport) throw new HttpError(503, "Email isn't set up on this server yet");
  try {
    await transport.sendMail({ from: config.MAIL_FROM, ...m });
  } catch (e) {
    throw Object.assign(new HttpError(503, "Couldn't send the email. Try again in a minute."), { cause: e });
  }
}

// ── Codes ────────────────────────────────────────────────────────────────
const digest = (userId: string, purpose: Purpose, code: string) =>
  createHmac('sha256', config.JWT_SECRET).update(`${purpose}:${userId}:${code}`).digest('hex');

const COPY: Record<Purpose, (code: string) => { subject: string; heading: string; intro: string }> = {
  verify_email: (code) => ({
    subject: `${code} is your LandConnect code`,
    heading: 'Verify your email',
    intro: 'enter this code in the LandConnect app to confirm this email is yours.',
  }),
  reset_password: (code) => ({
    subject: `${code} resets your LandConnect password`,
    heading: 'Reset your password',
    intro: 'enter this code in the LandConnect app to choose a new password.',
  }),
};

/** Create (or replace) the user's code for this purpose and email it. At most one per 30 s. */
export async function sendCode(user: { id: string; email: string; name: string }, purpose: Purpose) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const values = { codeHash: digest(user.id, purpose, code), attempts: 0, expiresAt: new Date(Date.now() + TTL_MIN * 60_000) };
  // The cooldown is part of the upsert, so two quick requests can't both send.
  const [row] = await db
    .insert(emailCodes)
    .values({ userId: user.id, purpose, ...values })
    .onConflictDoUpdate({
      target: [emailCodes.userId, emailCodes.purpose],
      set: { ...values, createdAt: new Date() },
      setWhere: sql`${emailCodes.createdAt} < now() - make_interval(secs => ${COOLDOWN_S})`,
    })
    .returning({ id: emailCodes.id });
  if (!row) throw new HttpError(429, `Wait ${COOLDOWN_S} seconds before asking for another code`);
  const { subject, heading, intro } = COPY[purpose](code);
  await sendMail({ to: user.email, subject, ...codeEmail({ name: user.name, email: user.email, code, heading, intro, ttlMin: TTL_MIN }) });
}

/** Check a code and use it up. Counts the attempt first, in SQL, so parallel guesses can't exceed the limit. */
export async function consumeCode(userId: string, purpose: Purpose, code: string) {
  const [row] = await db
    .update(emailCodes)
    .set({ attempts: sql`${emailCodes.attempts} + 1` })
    .where(
      and(
        eq(emailCodes.userId, userId),
        eq(emailCodes.purpose, purpose),
        gt(emailCodes.expiresAt, new Date()),
        lt(emailCodes.attempts, MAX_TRIES),
      ),
    )
    .returning();
  if (!row) throw new HttpError(400, 'This code has expired. Ask for a new one.');
  if (row.codeHash !== digest(userId, purpose, code)) {
    const left = MAX_TRIES - row.attempts;
    throw new HttpError(
      400,
      left > 0 ? `Wrong code. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong tries. Ask for a new code.',
    );
  }
  await db.delete(emailCodes).where(eq(emailCodes.id, row.id));
}
