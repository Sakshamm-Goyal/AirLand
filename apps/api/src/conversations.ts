import type { Conversation, ListingStub, Message, ServerToClient } from '@landconnect/shared';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import type { Server } from 'socket.io';
import { db, schema } from './db/client.ts';
import { toMessage, toPublicUser } from './dto.ts';

const { conversations, conversationMembers: members, messages, users, listings, blocks } = schema;

/** Set once in app.ts so HTTP routes can push realtime events too. */
export const bus: { io: Server<Record<string, never>, ServerToClient> | null } = { io: null };

export function notify<E extends keyof ServerToClient>(userIds: string[], event: E, ...args: Parameters<ServerToClient[E]>) {
  if (!bus.io || !userIds.length) return;
  bus.io.to(userIds.map((u) => `user:${u}`)).emit(event, ...args);
}

export async function memberIds(conversationId: string) {
  const rows = await db.select({ id: members.userId }).from(members).where(eq(members.conversationId, conversationId));
  return rows.map((r) => r.id);
}

export async function isBlocked(a: string, b: string) {
  const [row] = await db
    .select({ x: blocks.blockerId })
    .from(blocks)
    .where(or(and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)), and(eq(blocks.blockerId, b), eq(blocks.blockedId, a))))
    .limit(1);
  return Boolean(row);
}

/** In a 1:1 conversation, either side blocking the other stops messages and calls. Rooms are moderated by leaving. */
export async function blockedIn(memberIdList: string[], me: string) {
  const other = memberIdList.length === 2 ? memberIdList.find((id) => id !== me) : undefined;
  return other ? isBlocked(me, other) : false;
}

export async function postMessage(
  conversationId: string,
  senderId: string | null,
  body: string,
  kind: Message['kind'] = 'text',
  meta: Record<string, unknown> | null = null,
  clientId?: string,
): Promise<Message> {
  const [row] = await db.insert(messages).values({ conversationId, senderId, body, kind, meta }).returning();
  await db.update(conversations).set({ updatedAt: row!.createdAt }).where(eq(conversations.id, conversationId));
  if (senderId) {
    await db
      .update(members)
      .set({ lastReadAt: row!.createdAt })
      .where(and(eq(members.conversationId, conversationId), eq(members.userId, senderId)));
  }
  const msg = toMessage(row!, clientId);
  notify(await memberIds(conversationId), 'message:new', msg);
  return msg;
}

/** Inbox for one user, in 5 set-based queries regardless of conversation count. */
export async function listConversations(userId: string, onlyId?: string): Promise<Conversation[]> {
  const mine = await db
    .select({ id: members.conversationId })
    .from(members)
    .where(and(eq(members.userId, userId), onlyId ? eq(members.conversationId, onlyId) : undefined));
  const ids = mine.map((m) => m.id);
  if (!ids.length) return [];

  const [convRows, memberRows, lastRows, unreadRows] = await Promise.all([
    db
      .select({
        c: conversations,
        l: { id: listings.id, title: listings.title, priceInr: listings.priceInr, images: listings.images, locality: listings.locality },
      })
      .from(conversations)
      .leftJoin(listings, eq(listings.id, conversations.listingId))
      .where(inArray(conversations.id, ids))
      .orderBy(desc(conversations.updatedAt)),
    db
      .select({ cid: members.conversationId, u: users })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(inArray(members.conversationId, ids)),
    db
      .selectDistinctOn([messages.conversationId])
      .from(messages)
      .where(inArray(messages.conversationId, ids))
      .orderBy(messages.conversationId, desc(messages.createdAt)),
    db
      .select({ cid: messages.conversationId, n: sql<number>`count(*)::int` })
      .from(messages)
      .innerJoin(members, and(eq(members.conversationId, messages.conversationId), eq(members.userId, userId)))
      .where(
        and(
          inArray(messages.conversationId, ids),
          sql`${messages.createdAt} > ${members.lastReadAt}`,
          sql`${messages.senderId} is distinct from ${userId}`,
        ),
      )
      .groupBy(messages.conversationId),
  ]);

  const last = new Map(lastRows.map((m) => [m.conversationId, toMessage(m)]));
  const unread = new Map(unreadRows.map((r) => [r.cid, r.n]));
  return convRows.map(({ c, l }) => ({
    id: c.id,
    kind: c.kind,
    title: c.title,
    listing: l?.id
      ? ({ id: l.id, title: l.title, priceInr: l.priceInr, image: l.images[0] ?? null, locality: l.locality } satisfies ListingStub)
      : null,
    members: memberRows.filter((m) => m.cid === c.id).map((m) => toPublicUser(m.u)),
    lastMessage: last.get(c.id) ?? null,
    unread: unread.get(c.id) ?? 0,
    updatedAt: c.updatedAt.toISOString(),
  }));
}
