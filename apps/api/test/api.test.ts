import type { AuthResponse, CallInvite, ClientToServer, Conversation, Listing, Page, ServerToClient } from '@landconnect/shared';
import type { FastifyInstance } from 'fastify';
import { io as connect, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { sql } from '../src/db/client.ts';

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
async function user(role: 'buyer' | 'seller' | 'broker', extra: object = {}) {
  const r = await api<AuthResponse>('POST', '/auth/signup', undefined, {
    name: `${role} ${++n}`,
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
    await emit(b, 'call:invite', { conversationId: conv.id, kind: 'audio' });
    expect((await closed).reason).toBe('missed');
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
  });
});

describe('listing lifecycle', () => {
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
