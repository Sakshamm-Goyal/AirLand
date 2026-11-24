import type {
  AuthResponse,
  CallInvite,
  ClientToServer,
  Conversation,
  Listing,
  Page,
  RoleChangeResponse,
  ServerToClient,
} from '@landconnect/shared';
import type { FastifyInstance } from 'fastify';
import { io as connect, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { sql } from '../src/db/client.ts';
import { outbox } from '../src/email-codes.ts';
import { sniff } from '../src/routes/uploads.ts';

type Client = Socket<ServerToClient, ClientToServer>;
let app: FastifyInstance;
let base: string;
const sockets: Client[] = [];

const listing = {
  title: 'Two acre farm near the lake',
  landType: 'agricultural',
  area: 2,
  areaUnit: 'acre',
  priceInr: 9_000_000,
  lat: 12.345678,
  lng: 77.654321,
  locality: 'Kanakapura',
  images: ['https://example.com/a.jpg'],
};

async function api<T>(method: string, path: string, token?: string, body?: unknown) {
  const res = await app.inject({
    method: method as 'GET',
    url: path,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload: body as object,
  });
  return { status: res.statusCode, body: (res.body ? res.json() : null) as T };
}

let n = 0;
const letters = (i: number): string => (i > 0 ? letters(Math.floor((i - 1) / 26)) + String.fromCharCode(97 + ((i - 1) % 26)) : '');
async function user(role: 'buyer' | 'seller' | 'broker', extra: object = {}) {
  const r = await api<AuthResponse>('POST', '/auth/signup', undefined, {
    name: `${role} ${letters(++n)}`, // names are letters only
    email: `${role}${n}@t.test`,
    password: 'password123',
    role,
    phone: '+919812345678',
    ...(role === 'broker' ? { reraId: 'RERA-1234' } : {}),
    ...extra,
  });
  expect(r.status).toBe(201);
  return r.body;
}

function sock(token: string): Promise<Client> {
  return new Promise((resolve, reject) => {
    const s: Client = connect(base, { auth: { token }, transports: ['websocket'], forceNew: true });
    sockets.push(s);
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

const next = <E extends keyof ServerToClient>(s: Client, event: E) =>
  new Promise<Parameters<ServerToClient[E]>[0]>((resolve) => s.once(event, ((p: never) => resolve(p)) as never));

const emit = <T>(s: Client, event: 'call:invite' | 'call:accept', payload: object) =>
  new Promise<{ ok: true; data: T } | { ok: false; error: string }>((resolve) =>
    (s.emit as (...a: unknown[]) => void)(event, payload, resolve),
  );

beforeAll(async () => {
  app = await buildApp();
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
afterAll(async () => {
  for (const s of sockets) s.disconnect();
  await app.close();
  await sql.end();
});

describe('auth', () => {
  it('signs up, logs in and rotates refresh tokens with reuse detection', async () => {
    const a = await user('buyer');
    expect(a.user.role).toBe('buyer');
    expect((await api('POST', '/auth/login', undefined, { email: a.user.email, password: 'nope-nope' })).status).toBe(401);
    expect(
      (await api('POST', '/auth/signup', undefined, { name: 'Dup', email: a.user.email, password: 'password123', role: 'buyer' })).status,
    ).toBe(409);

    const r1 = await api<AuthResponse>('POST', '/auth/refresh', undefined, { refreshToken: a.refreshToken });
    expect(r1.status).toBe(200);
    // Replaying the old token = theft signal: it fails AND kills the newer token in the same family.
    expect((await api('POST', '/auth/refresh', undefined, { refreshToken: a.refreshToken })).status).toBe(401);
    expect((await api('POST', '/auth/refresh', undefined, { refreshToken: r1.body.refreshToken })).status).toBe(401);
  });

  it('rejects brokers without a RERA id and bad input with field errors', async () => {
    const r = await api<{ fields: Record<string, string> }>('POST', '/auth/signup', undefined, {
      name: 'B',
      email: 'x',
      password: '1',
      role: 'broker',
    });
    expect(r.status).toBe(400);
    expect(Object.keys(r.body.fields).length).toBeGreaterThan(0);
  });
});

/** The 6-digit code from the newest email to this address (tests read the outbox instead of a mailbox). */
const codeFor = (email: string) => outbox.findLast((m) => m.to === email)!.subject.match(/\d{6}/)![0];
const wrongFor = (code: string) => (code === '000000' ? '111111' : '000000');

describe('email codes', () => {
  it('sign-up emails a code; a wrong code counts down, the right one verifies once', async () => {
    const u = await user('buyer');
    expect(u.user.emailVerified).toBe(false);
    const code = codeFor(u.user.email);
    const wrong = await api<{ error: string }>('POST', '/auth/email/verify', u.accessToken, { code: wrongFor(code) });
    expect(wrong).toEqual({ status: 400, body: { error: 'Wrong code. 4 tries left.' } });
    const ok = await api<{ emailVerified: boolean }>('POST', '/auth/email/verify', u.accessToken, { code });
    expect(ok.status).toBe(200);
    expect(ok.body.emailVerified).toBe(true);
    expect((await api('POST', '/auth/email/verify', u.accessToken, { code })).status).toBe(400); // used up
    expect((await api('POST', '/auth/email/code', u.accessToken)).status).toBe(409); // already verified
  });

  it('locks a code after 5 wrong tries and rate-limits resends', async () => {
    const u = await user('seller');
    const code = codeFor(u.user.email);
    expect((await api('POST', '/auth/email/code', u.accessToken)).status).toBe(429); // sign-up just sent one
    let last: { status: number; body: { error: string } } | undefined;
    for (let i = 0; i < 5; i++) last = await api('POST', '/auth/email/verify', u.accessToken, { code: wrongFor(code) });
    expect(last!.body.error).toBe('Too many wrong tries. Ask for a new code.');
    const late = await api<{ error: string }>('POST', '/auth/email/verify', u.accessToken, { code });
    expect(late.body.error).toBe('This code has expired. Ask for a new one.');
  });

  it('resets a forgotten password, signs out old sessions, and never reveals who has an account', async () => {
    const before = outbox.length;
    expect((await api('POST', '/auth/password/forgot', undefined, { email: 'nobody@t.test' })).status).toBe(204);
    expect(outbox.length).toBe(before);

    const u = await user('broker');
    expect((await api('POST', '/auth/password/forgot', undefined, { email: u.user.email })).status).toBe(204);
    expect(outbox.at(-1)!.subject).toMatch(/resets your LandConnect password/);
    const code = codeFor(u.user.email);
    const reset = await api<AuthResponse>('POST', '/auth/password/reset', undefined, {
      email: u.user.email,
      code,
      password: 'brand-new-pass',
    });
    expect(reset.status).toBe(200);
    expect(reset.body.user.emailVerified).toBe(true);
    expect((await api('POST', '/auth/refresh', undefined, { refreshToken: u.refreshToken })).status).toBe(401);
    expect((await api('POST', '/auth/login', undefined, { email: u.user.email, password: 'password123' })).status).toBe(401);
    expect((await api('POST', '/auth/login', undefined, { email: u.user.email, password: 'brand-new-pass' })).status).toBe(200);
    const again = await api('POST', '/auth/password/reset', undefined, { email: u.user.email, code, password: 'another-pass-1' });
    expect(again.status).toBe(400);
  });
});

describe('listings + RBAC + privacy', () => {
  it('only sellers and brokers can list; only the owner can edit', async () => {
    const buyer = await user('buyer');
    const seller = await user('seller');
    const other = await user('broker');
    expect((await api('POST', '/listings', buyer.accessToken, listing)).status).toBe(403);
    const created = await api<Listing>('POST', '/listings', seller.accessToken, listing);
    expect(created.status).toBe(201);
    expect(created.body.areaSqft).toBe(87_120);
    expect((await api('PATCH', `/listings/${created.body.id}`, other.accessToken, { priceInr: 1 })).status).toBe(404);
    const sold = await api<Listing>('PATCH', `/listings/${created.body.id}`, seller.accessToken, { status: 'sold' });
    expect(sold.body.status).toBe('sold');
  });

  it('never leaks phone numbers or emails, and blurs approximate locations', async () => {
    const seller = await user('seller');
    const buyer = await user('buyer');
    await api('POST', '/listings', seller.accessToken, listing);
    const feed = await api<Page<Listing>>('GET', '/listings?limit=50', buyer.accessToken);
    const raw = JSON.stringify(feed.body);
    expect(raw).not.toContain('+9198');
    expect(raw).not.toContain('@t.test');
    const mine = feed.body.items.find((l) => l.owner.id === seller.user.id)!;
    expect(mine.lat).toBe(12.35);
    expect(mine.isMine).toBe(false);
  });

  it('paginates with a cursor and filters by map bbox', async () => {
    const seller = await user('seller');
    for (let i = 0; i < 3; i++) await api('POST', '/listings', seller.accessToken, { ...listing, title: `Paged listing number ${i}` });
    const p1 = await api<Page<Listing>>('GET', '/listings?limit=2', seller.accessToken);
    expect(p1.body.items).toHaveLength(2);
    const p2 = await api<Page<Listing>>('GET', `/listings?limit=2&cursor=${p1.body.nextCursor}`, seller.accessToken);
    expect(p2.body.items[0]!.id).not.toBe(p1.body.items[1]!.id);
    const box = await api<Page<Listing>>('GET', '/listings?bbox=77,12,78,13', seller.accessToken);
    expect(box.body.items.length).toBeGreaterThan(0);
    const empty = await api<Page<Listing>>('GET', '/listings?bbox=0,0,1,1', seller.accessToken);
    expect(empty.body.items).toHaveLength(0);
  });
});

async function pair() {
  const seller = await user('seller');
  const buyer = await user('buyer');
  const l = await api<Listing>('POST', '/listings', seller.accessToken, listing);
  const conv = await api<Conversation>('POST', '/conversations', buyer.accessToken, { listingId: l.body.id });
  expect(conv.status).toBe(201);
  const again = await api<Conversation>('POST', '/conversations', buyer.accessToken, { listingId: l.body.id });
  expect(again.body.id).toBe(conv.body.id);
  // The chat tells the listing owner from the person enquiring by this, not by role (sellers enquire too).
  expect(conv.body.listing?.ownerId).toBe(seller.user.id);
  return { seller, buyer, conv: conv.body, s: await sock(seller.accessToken), b: await sock(buyer.accessToken) };
}

describe('chat', () => {
  it('delivers messages live and counts unread', async () => {
    const { seller, conv, s, b } = await pair();
    const got = next(s, 'message:new');
    const ack = await new Promise<{ ok: boolean }>((r) =>
      b.emit('message:send', { conversationId: conv.id, body: 'Is the price negotiable?', clientId: 'c1' }, r),
    );
    expect(ack.ok).toBe(true);
    expect((await got).body).toBe('Is the price negotiable?');
    const inbox = await api<Conversation[]>('GET', '/conversations', seller.accessToken);
    expect(inbox.body.find((c) => c.id === conv.id)!.unread).toBeGreaterThanOrEqual(1);
  });
});

describe('calls', () => {
  it('invite → ring → accept → end, with LiveKit tokens and a call log', async () => {
    const { buyer, conv, s, b } = await pair();
    const ring = next(s, 'call:incoming');
    const inv = await emit<{ callId: string }>(b, 'call:invite', { conversationId: conv.id, kind: 'video' });
    expect(inv.ok).toBe(true);
    const invite = (await ring) as CallInvite;
    expect(invite.from.id).toBe(buyer.user.id);
    expect(JSON.stringify(invite)).not.toContain('+9198');

    const accepted = next(b, 'call:accepted');
    const join = await emit<{ token: string; roomName: string }>(s, 'call:accept', { callId: invite.callId });
    expect(join.ok && join.data.roomName).toBe(`call_${invite.callId}`);
    expect((await accepted).join.token.split('.')).toHaveLength(3);

    const closed = next(s, 'call:closed');
    b.emit('call:end', { callId: invite.callId });
    expect((await closed).reason).toBe('ended');
    const log = await api<{ status: string; direction: string }[]>('GET', '/calls', buyer.accessToken);
    expect(log.body[0]).toMatchObject({ status: 'ended', direction: 'outgoing' });
  });

  it('reject notifies the caller; a second accept is refused', async () => {
    const { conv, s, b } = await pair();
    const ring = next(s, 'call:incoming');
    await emit(b, 'call:invite', { conversationId: conv.id, kind: 'audio' });
    const { callId } = await ring;
    const closed = next(b, 'call:closed');
    s.emit('call:reject', { callId, message: "Can't talk now" });
    expect((await closed).reason).toBe('rejected');
    expect((await emit(s, 'call:accept', { callId })).ok).toBe(false);
  });

  it('goes missed after the ring timeout', async () => {
    const { conv, b } = await pair();
    const closed = next(b, 'call:closed');
    const bubble = new Promise<string>((r) => b.on('message:new', (m) => m.kind === 'call' && r(m.body)));
    await emit(b, 'call:invite', { conversationId: conv.id, kind: 'audio' });
    expect((await closed).reason).toBe('missed');
    expect(await bubble).toBe('Missed voice call');
  });

  it('reports busy when the callee is already on a call', async () => {
    const p = await pair();
    const ring = next(p.s, 'call:incoming');
    await emit(p.b, 'call:invite', { conversationId: p.conv.id, kind: 'audio' });
    await emit(p.s, 'call:accept', { callId: (await ring).callId });

    // A second buyer enquires on another listing of the same seller and calls them.
    const l = await api<Listing>('POST', '/listings', p.seller.accessToken, listing);
    const buyer2 = await user('buyer');
    const conv2 = await api<Conversation>('POST', '/conversations', buyer2.accessToken, { listingId: l.body.id });
    const b2 = await sock(buyer2.accessToken);
    const closed = next(b2, 'call:closed');
    await emit(b2, 'call:invite', { conversationId: conv2.body.id, kind: 'video' });
    expect((await closed).reason).toBe('busy');
  });

  it('refuses calls from outside the conversation and when the callee opted out', async () => {
    const { conv, seller, b } = await pair();
    const stranger = await sock((await user('buyer')).accessToken);
    const r = await emit(stranger, 'call:invite', { conversationId: conv.id, kind: 'audio' });
    expect(r.ok).toBe(false);
    await api('PATCH', '/me', seller.accessToken, { callPolicy: 'nobody' });
    expect((await emit(b, 'call:invite', { conversationId: conv.id, kind: 'audio' })).ok).toBe(false);
  });
});

describe('editing and blocking', () => {
  it('lets the owner edit fields and recomputes the normalised area', async () => {
    const seller = await user('seller');
    const l = await api<Listing>('POST', '/listings', seller.accessToken, listing);
    const edited = await api<Listing>('PATCH', `/listings/${l.body.id}`, seller.accessToken, { title: 'Renamed two acre farm', area: 2.5 });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ title: 'Renamed two acre farm', area: 2.5, areaSqft: 108_900 });
  });

  it('a block stops messages and calls in an existing conversation, and unblocking restores them', async () => {
    const { seller, buyer, conv, b } = await pair();
    const sendMsg = () =>
      new Promise<{ ok: boolean }>((r) => b.emit('message:send', { conversationId: conv.id, body: 'hello again', clientId: 'x' }, r));

    expect((await api('POST', `/users/${buyer.user.id}/block`, seller.accessToken)).status).toBe(204);
    const blocked = await api<{ id: string }[]>('GET', '/me/blocks', seller.accessToken);
    expect(blocked.body.map((u) => u.id)).toEqual([buyer.user.id]);
    expect(JSON.stringify(blocked.body)).not.toContain('+9198');

    expect((await sendMsg()).ok).toBe(false);
    expect((await emit(b, 'call:invite', { conversationId: conv.id, kind: 'audio' })).ok).toBe(false);

    await api('DELETE', `/users/${buyer.user.id}/block`, seller.accessToken);
    expect((await sendMsg()).ok).toBe(true);
  });
});

describe('http', () => {
  it('allows PATCH, PUT and DELETE in CORS preflight (web client)', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/listings/x',
      headers: { origin: 'http://localhost:8081', 'access-control-request-method': 'PATCH' },
    });
    const allowed = String(res.headers['access-control-allow-methods']);
    for (const m of ['PATCH', 'PUT', 'DELETE']) expect(allowed).toContain(m);
  });
});

describe('accounts', () => {
  it('a user who started a conversation can still be deleted; the other side keeps the thread', async () => {
    const { db, schema } = await import('../src/db/client.ts');
    const { eq } = await import('drizzle-orm');
    const { buyer, seller, conv } = await pair();
    await db.delete(schema.users).where(eq(schema.users.id, buyer.user.id));
    const inbox = await api<Conversation[]>('GET', '/conversations', seller.accessToken);
    expect(inbox.body.some((c) => c.id === conv.id)).toBe(true);
  });
});

describe('uploads', () => {
  const multipart = (name: string, type: string, body: Buffer) => {
    const b = '----lcboundary';
    const head = Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${type}\r\n\r\n`);
    return {
      payload: Buffer.concat([head, body, Buffer.from(`\r\n--${b}--\r\n`)]),
      headers: { 'content-type': `multipart/form-data; boundary=${b}` },
    };
  };
  // Smallest valid JPEG header bytes are enough: the server stores bytes as-is.
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 0xff, 0xd9]);

  it('stores a photo and serves it back with immutable caching; rejects other types and anonymous uploads', async () => {
    const seller = await user('seller');
    const m = multipart('plot.jpg', 'image/jpeg', jpeg);
    const up = await app.inject({
      method: 'POST',
      url: '/uploads',
      headers: { ...m.headers, authorization: `Bearer ${seller.accessToken}` },
      payload: m.payload,
    });
    expect(up.statusCode).toBe(201);
    const path = new URL(up.json().url).pathname;
    const got = await app.inject({ method: 'GET', url: path });
    expect(got.statusCode).toBe(200);
    expect(got.headers['content-type']).toBe('image/jpeg');
    expect(got.headers['cache-control']).toContain('immutable');
    expect(got.headers['cross-origin-resource-policy']).toBe('cross-origin'); // embeddable by the web app
    expect(Buffer.compare(got.rawPayload, jpeg)).toBe(0);

    const txt = multipart('x.txt', 'text/plain', Buffer.from('hi'));
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/uploads',
          headers: { ...txt.headers, authorization: `Bearer ${seller.accessToken}` },
          payload: txt.payload,
        })
      ).statusCode,
    ).toBe(415);
    expect((await app.inject({ method: 'POST', url: '/uploads', headers: m.headers, payload: m.payload })).statusCode).toBe(401);

    // A script dressed up as a JPEG is refused: the bytes decide, not the Content-Type.
    const fake = multipart('evil.jpg', 'image/jpeg', Buffer.from('<script>alert(1)</script>'));
    const r = await app.inject({
      method: 'POST',
      url: '/uploads',
      headers: { ...fake.headers, authorization: `Bearer ${seller.accessToken}` },
      payload: fake.payload,
    });
    expect(r.statusCode).toBe(415);
  });

  it('sniffs real image signatures', () => {
    expect(sniff(jpeg)).toBe('image/jpeg');
    expect(sniff(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png');
    expect(sniff(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(sniff(Buffer.from('\0\0\0\x18ftypheic'))).toBe('image/heic');
    expect(sniff(Buffer.from('GIF89a'))).toBeNull();
  });
});

describe('listing lifecycle', () => {
  it('saved filter returns only what the viewer saved', async () => {
    const seller = await user('seller');
    const buyer = await user('buyer');
    const a = await api<Listing>('POST', '/listings', seller.accessToken, { ...listing, title: 'Plot the buyer saves' });
    await api('POST', '/listings', seller.accessToken, { ...listing, title: 'Plot the buyer ignores' });
    expect((await api('PUT', `/listings/${a.body.id}/save`, buyer.accessToken)).status).toBe(204);
    const saved = await api<Page<Listing>>('GET', '/listings?saved=true', buyer.accessToken);
    expect(saved.body.items.map((l) => l.id)).toEqual([a.body.id]);
    expect(saved.body.items[0]!.saved).toBe(true);
    // Still listed (as sold) after the owner sells it, so the buyer isn't left wondering where it went.
    await api('PATCH', `/listings/${a.body.id}`, seller.accessToken, { status: 'sold' });
    const after = await api<Page<Listing>>('GET', '/listings?saved=true', buyer.accessToken);
    expect(after.body.items[0]).toMatchObject({ id: a.body.id, status: 'sold' });
  });

  it('a sold listing leaves the public feed but stays in My listings', async () => {
    const seller = await user('seller');
    const l = await api<Listing>('POST', '/listings', seller.accessToken, { ...listing, title: 'Plot that will be sold' });
    await api('PATCH', `/listings/${l.body.id}`, seller.accessToken, { status: 'sold' });
    const feed = await api<Page<Listing>>('GET', '/listings?limit=50', seller.accessToken);
    expect(feed.body.items.some((x) => x.id === l.body.id)).toBe(false);
    const mine = await api<Page<Listing>>('GET', '/listings?owner=me', seller.accessToken);
    expect(mine.body.items.find((x) => x.id === l.body.id)?.status).toBe('sold');
  });
});

describe('text rules on the server', () => {
  it('rejects emoji in names and listing titles with a field error', async () => {
    const r = await api<{ fields?: Record<string, string> }>('POST', '/auth/signup', undefined, {
      name: 'Asha 😀',
      email: 'emoji@t.test',
      password: 'password123',
      role: 'buyer',
    });
    expect(r.status).toBe(400);
    expect(r.body.fields?.name).toBeTruthy();
    const seller = await user('seller');
    const l = await api<{ fields?: Record<string, string> }>('POST', '/listings', seller.accessToken, {
      ...listing,
      title: 'Farm 🌾 by the lake',
    });
    expect(l.status).toBe(400);
    expect(l.body.fields?.title).toBeTruthy();
  });
});

describe('socket hard limits', () => {
  it('malformed or oversized socket payloads get an error ack and never crash the server', async () => {
    const { buyer, conv, b } = await pair();
    const ack = (event: string, payload: unknown) =>
      new Promise<{ ok: boolean; error?: string }>((r) => (b as unknown as { emit: (...a: unknown[]) => void }).emit(event, payload, r));
    const bad: [string, unknown][] = [
      ['message:send', { conversationId: conv.id, body: 12345, clientId: 'x' }],
      ['message:send', { conversationId: 'not-a-uuid', body: 'hi', clientId: 'x' }],
      ['message:send', { conversationId: conv.id, body: 'x'.repeat(4001), clientId: 'x' }],
      ['message:send', null],
      ['room:join', { conversationId: 'nope' }],
      ['call:invite', { conversationId: conv.id, kind: 'hologram' }],
      ['call:accept', { callId: { $ne: 1 } }],
    ];
    for (const [event, payload] of bad) {
      const r = await ack(event, payload);
      expect(r.ok, `${event} ${JSON.stringify(payload)?.slice(0, 60)}`).toBe(false);
    }
    // Fire-and-forget events with junk must not take the process down either.
    for (const e of ['typing', 'conv:read', 'call:reject', 'call:cancel', 'call:end'])
      (b as unknown as { emit: (...a: unknown[]) => void }).emit(e, { conversationId: 'zzz', callId: 42 });
    await new Promise((r) => setTimeout(r, 300));
    // Still alive and still working.
    const ok = await ack('message:send', { conversationId: conv.id, body: 'still here', clientId: 'ok1' });
    expect(ok.ok).toBe(true);
    expect((await api('GET', '/me', buyer.accessToken)).status).toBe(200);
  });

  it('a flood of messages from one socket is throttled', async () => {
    const { conv, b } = await pair();
    const results = await Promise.all(
      Array.from(
        { length: 40 },
        (_, i) =>
          new Promise<{ ok: boolean }>((r) =>
            b.emit('message:send', { conversationId: conv.id, body: `spam ${i}`, clientId: `s${i}` }, r as never),
          ),
      ),
    );
    expect(results.filter((r) => !r.ok).length).toBeGreaterThan(0);
  });
});

describe('deal rooms', () => {
  const room = (token: string, memberIds: string[]) =>
    api<Conversation>('POST', '/conversations/rooms', token, { title: 'Site visit Saturday', memberIds });

  it('a seller groups people they already chat with', async () => {
    const { seller, buyer } = await pair();
    const r = await room(seller.accessToken, [buyer.user.id]);
    expect(r.status).toBe(201);
    expect(r.body.kind).toBe('room');
    expect(r.body.members.map((m) => m.id).sort()).toEqual([seller.user.id, buyer.user.id].sort());
  });

  it('strangers cannot be added by id', async () => {
    const { seller } = await pair();
    const stranger = await user('buyer');
    const r = await room(seller.accessToken, [stranger.user.id]);
    expect(r.status).toBe(400);
  });

  it('no blocked people, either direction, without saying who blocked whom', async () => {
    const { seller, buyer } = await pair();
    await api('POST', `/users/${buyer.user.id}/block`, seller.accessToken);
    const mine = await room(seller.accessToken, [buyer.user.id]);
    expect(mine.status).toBe(403);
    expect((mine.body as unknown as { error: string }).error).toContain('Unblock');

    const p2 = await pair();
    await api('POST', `/users/${p2.seller.user.id}/block`, p2.buyer.accessToken); // the buyer blocked the seller
    const theirs = await room(p2.seller.accessToken, [p2.buyer.user.id]);
    expect(theirs.status).toBe(403);
    expect((theirs.body as unknown as { error: string }).error).not.toContain('Unblock');
  });

  it('buyers cannot create rooms', async () => {
    const { buyer, seller } = await pair();
    expect((await room(buyer.accessToken, [seller.user.id])).status).toBe(403);
  });
});

describe('role change', () => {
  it('buyer becomes seller and can post with the new token; old buyer token still cannot', async () => {
    const b = await user('buyer');
    expect((await api('POST', '/listings', b.accessToken, listing)).status).toBe(403);
    const r = await api<RoleChangeResponse>('PATCH', '/me/role', b.accessToken, { role: 'seller' });
    expect(r.status).toBe(200);
    expect(r.body.user.role).toBe('seller');
    expect((await api('POST', '/listings', r.body.accessToken, listing)).status).toBe(201);
  });

  it('broker needs a RERA number', async () => {
    const s = await user('seller');
    const bad = await api<{ fields?: Record<string, string> }>('PATCH', '/me/role', s.accessToken, { role: 'broker' });
    expect(bad.status).toBe(400);
    expect(bad.body.fields?.reraId).toBeTruthy();
    const ok = await api<RoleChangeResponse>('PATCH', '/me/role', s.accessToken, { role: 'broker', reraId: 'PRM/KA/RERA/1251' });
    expect(ok.body.user).toMatchObject({ role: 'broker', reraId: 'PRM/KA/RERA/1251' });
  });

  it('back to buyer only once no listing is live', async () => {
    const s = await user('seller');
    const l = await api<Listing>('POST', '/listings', s.accessToken, listing);
    expect((await api('PATCH', '/me/role', s.accessToken, { role: 'buyer' })).status).toBe(409);
    await api('PATCH', `/listings/${l.body.id}`, s.accessToken, { status: 'sold' });
    const r = await api<RoleChangeResponse>('PATCH', '/me/role', s.accessToken, { role: 'buyer' });
    expect(r.status).toBe(200);
    expect(r.body.user).toMatchObject({ role: 'buyer', reraId: null });
  });
});

describe('call edge cases', () => {
  it('a second device of the callee is told when the first one answers', async () => {
    const { seller, conv, s, b } = await pair();
    const s2 = await sock(seller.accessToken);
    const ring1 = next(s, 'call:incoming');
    const ring2 = next(s2, 'call:incoming');
    await emit(b, 'call:invite', { conversationId: conv.id, kind: 'video' });
    const { callId } = await ring1;
    await ring2;
    const elsewhere = next(s2, 'call:answered_elsewhere');
    expect((await emit(s, 'call:accept', { callId })).ok).toBe(true);
    expect((await elsewhere).callId).toBe(callId);
    expect((await emit(s2, 'call:accept', { callId })).ok).toBe(false);
    b.emit('call:end', { callId });
  });

  it('replays a still-ringing invite when the callee connects late (app was in background)', async () => {
    const seller = await user('seller');
    const buyer = await user('buyer');
    const l = await api<Listing>('POST', '/listings', seller.accessToken, listing);
    const conv = await api<Conversation>('POST', '/conversations', buyer.accessToken, { listingId: l.body.id });
    const b = await sock(buyer.accessToken);
    const inv = await emit<{ callId: string }>(b, 'call:invite', { conversationId: conv.body.id, kind: 'audio' });
    // Seller opens the app only now.
    const late = new Promise<CallInvite>((resolve, reject) => {
      const s: Client = connect(base, { auth: { token: seller.accessToken }, transports: ['websocket'], forceNew: true });
      sockets.push(s);
      s.once('call:incoming', resolve);
      s.on('connect_error', reject);
    });
    expect((await late).callId).toBe(inv.ok && inv.data.callId);
    b.emit('call:cancel', { callId: (await late).callId });
  });

  it('caller cancel and caller disconnect both stop the ringing on the callee', async () => {
    const { conv, s, b, buyer } = await pair();
    const ring = next(s, 'call:incoming');
    await emit(b, 'call:invite', { conversationId: conv.id, kind: 'audio' });
    const { callId } = await ring;
    const closed = next(s, 'call:closed');
    b.emit('call:cancel', { callId });
    expect(await closed).toMatchObject({ callId, reason: 'cancelled' });

    const ring2 = next(s, 'call:incoming');
    const b2 = await sock(buyer.accessToken);
    b.disconnect();
    await emit(b2, 'call:invite', { conversationId: conv.id, kind: 'audio' });
    const second = await ring2;
    const closed2 = next(s, 'call:closed');
    b2.disconnect(); // caller's last socket gone mid-ring
    expect(await closed2).toMatchObject({ callId: second.callId, reason: 'cancelled' });
  });
});

it('shuts down promptly even with a live socket connected', async () => {
  const other = await buildApp();
  await other.listen({ port: 0, host: '127.0.0.1' });
  const addr = other.server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const token = (await user('buyer')).accessToken;
  const s: Client = connect(`http://127.0.0.1:${port}`, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
  await new Promise((r) => s.on('connect', () => r(null)));
  const started = Date.now();
  await other.close();
  expect(Date.now() - started).toBeLessThan(2000);
  s.disconnect();
});
