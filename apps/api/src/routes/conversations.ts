import { type CallLogEntry, createRoomSchema, messagesQuerySchema, startConversationSchema } from '@landconnect/shared';
import { and, desc, eq, inArray, lt, or } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate, can } from '../auth.ts';
import { isBlocked, listConversations, memberIds, postMessage } from '../conversations.ts';
import { db, schema } from '../db/client.ts';
import { toMessage, toPublicUser } from '../dto.ts';
import { forbidden, HttpError, notFound } from '../errors.ts';

const { conversations, conversationMembers: members, messages, listings, users, calls, blocks } = schema;
const params = z.object({ id: z.uuid() });

export const conversationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', authenticate);

  app.get('/conversations', async (req) => listConversations(req.user.id));

  app.get('/conversations/:id', { schema: { params } }, async (req) => {
    const [conv] = await listConversations(req.user.id, req.params.id);
    if (!conv) throw notFound('Conversation not found');
    return conv;
  });

  /** Enquire on a listing: one thread per (buyer, listing), created on first contact. */
  app.post('/conversations', { schema: { body: startConversationSchema } }, async (req, reply) => {
    const me = req.user.id;
    const [listing] = await db.select().from(listings).where(eq(listings.id, req.body.listingId));
    if (!listing) throw notFound('Listing not found');
    if (listing.ownerId === me) throw new HttpError(400, 'This is your own listing');
    if (await isBlocked(me, listing.ownerId)) throw forbidden("You can't contact this person");

    const directKey = `${listing.id}:${[me, listing.ownerId].sort().join(':')}`;
    const [created] = await db
      .insert(conversations)
      .values({ kind: 'direct', listingId: listing.id, createdBy: me, directKey })
      .onConflictDoNothing({ target: conversations.directKey })
      .returning();
    if (created) {
      await db.insert(members).values([
        { conversationId: created.id, userId: me },
        { conversationId: created.id, userId: listing.ownerId },
      ]);
      await postMessage(
        created.id,
        null,
        `Enquiry about “${listing.title}”. Phone numbers stay hidden. Chat and call right here.`,
        'system',
      );
      reply.code(201);
    }
    const id =
      created?.id ?? (await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.directKey, directKey)))[0]!.id;
    const [conv] = await listConversations(me, id);
    return conv;
  });

  /** Deal room: a group thread + group video meeting for a site-visit or negotiation. */
  app.post('/conversations/rooms', { preHandler: can('seller', 'broker'), schema: { body: createRoomSchema } }, async (req, reply) => {
    const me = req.user.id;
    const others = [...new Set(req.body.memberIds)].filter((id) => id !== me);
    if (!others.length) throw new HttpError(400, 'Add at least one person');
    // Like WhatsApp: only people you already have a 1:1 chat with (no adding strangers by id) ...
    const myConvs = db.select({ id: members.conversationId }).from(members).where(eq(members.userId, me));
    const contacts = await db
      .selectDistinct({ id: members.userId, name: users.name })
      .from(members)
      .innerJoin(conversations, eq(conversations.id, members.conversationId))
      .innerJoin(users, eq(users.id, members.userId))
      .where(and(eq(conversations.kind, 'direct'), inArray(members.conversationId, myConvs), inArray(members.userId, others)));
    if (contacts.length !== others.length) throw new HttpError(400, 'You can only add people you are already chatting with');
    // ... and nobody with a block either way. Who blocked whom stays private, as everywhere else.
    const blockRows = await db
      .select({ blocker: blocks.blockerId, blocked: blocks.blockedId })
      .from(blocks)
      .where(
        or(
          and(eq(blocks.blockerId, me), inArray(blocks.blockedId, others)),
          and(inArray(blocks.blockerId, others), eq(blocks.blockedId, me)),
        ),
      );
    const iBlocked = blockRows.find((b) => b.blocker === me);
    if (iBlocked) throw new HttpError(403, `Unblock ${contacts.find((c) => c.id === iBlocked.blocked)?.name ?? 'them'} to add them`);
    if (blockRows.length) throw new HttpError(403, "Couldn't add some people to this room");
    const ids = [me, ...others];
    const [room] = await db
      .insert(conversations)
      .values({ kind: 'room', title: req.body.title, listingId: req.body.listingId, createdBy: req.user.id })
      .returning();
    await db.insert(members).values(ids.map((userId) => ({ conversationId: room!.id, userId })));
    await postMessage(room!.id, null, `${req.body.title} created. Start a meeting from the header when everyone is ready.`, 'system');
    reply.code(201);
    const [conv] = await listConversations(req.user.id, room!.id);
    return conv;
  });

  /** Leave a deal room (WhatsApp "Exit group"). The others see "<name> left"; a 1:1 chat can't be left, only blocked. */
  app.delete('/conversations/:id/members/me', { schema: { params } }, async (req, reply) => {
    const me = req.user.id;
    const rooms = db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, req.params.id), eq(conversations.kind, 'room')));
    const [left] = await db
      .delete(members)
      .where(and(eq(members.conversationId, req.params.id), eq(members.userId, me), inArray(members.conversationId, rooms)))
      .returning();
    if (!left) {
      if ((await memberIds(req.params.id)).includes(me)) throw new HttpError(400, "A 1:1 chat can't be left. Block the person instead.");
      throw notFound('Room not found');
    }
    const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, me));
    await postMessage(req.params.id, null, `${u?.name ?? 'Someone'} left`, 'system');
    return reply.code(204).send();
  });

  app.get('/conversations/:id/messages', { schema: { params, querystring: messagesQuerySchema } }, async (req) => {
    if (!(await memberIds(req.params.id)).includes(req.user.id)) throw notFound('Conversation not found');
    const rows = await db
      .select()
      .from(messages)
      .where(
        and(eq(messages.conversationId, req.params.id), req.query.before ? lt(messages.createdAt, new Date(req.query.before)) : undefined),
      )
      .orderBy(desc(messages.createdAt))
      .limit(req.query.limit);
    return rows.map((m) => toMessage(m)); // newest first
  });

  app.get('/calls', async (req): Promise<CallLogEntry[]> => {
    const me = req.user.id;
    const rows = await db
      .select({ c: calls, caller: users })
      .from(calls)
      .innerJoin(users, eq(users.id, calls.callerId))
      .where(or(eq(calls.callerId, me), eq(calls.calleeId, me)))
      .orderBy(desc(calls.createdAt))
      .limit(100);
    const calleeIds = [...new Set(rows.map((r) => r.c.calleeId))];
    const callees = calleeIds.length ? await db.select().from(users).where(inArray(users.id, calleeIds)) : [];
    const byId = new Map(callees.map((u) => [u.id, u]));
    return rows.map(({ c, caller }) => {
      const outgoing = c.callerId === me;
      return {
        id: c.id,
        conversationId: c.conversationId,
        kind: c.kind,
        status: c.status,
        direction: outgoing ? 'outgoing' : 'incoming',
        peer: toPublicUser(outgoing ? byId.get(c.calleeId)! : caller),
        startedAt: c.createdAt.toISOString(),
        durationSec: c.answeredAt && c.endedAt ? Math.round((c.endedAt.getTime() - c.answeredAt.getTime()) / 1000) : null,
      };
    });
  });
};
