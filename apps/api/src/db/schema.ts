import { AREA_UNITS, CALL_KINDS, CALL_POLICIES, CALL_STATUSES, LAND_TYPES, ROLES } from '@landconnect/shared';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ROLES);
export const landTypeEnum = pgEnum('land_type', LAND_TYPES);
export const areaUnitEnum = pgEnum('area_unit', AREA_UNITS);
export const listingStatusEnum = pgEnum('listing_status', ['active', 'sold']);
export const convKindEnum = pgEnum('conversation_kind', ['direct', 'room']);
export const messageKindEnum = pgEnum('message_kind', ['text', 'system', 'call']);
export const callKindEnum = pgEnum('call_kind', CALL_KINDS);
export const callStatusEnum = pgEnum('call_status', CALL_STATUSES);
export const callPolicyEnum = pgEnum('call_policy', CALL_POLICIES);

const id = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp('created_at', { withTimezone: true, precision: 3 }).notNull().defaultNow();

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: roleEnum('role').notNull(),
  /** Private. Only ever returned to its owner (see dto.ts). */
  phone: text('phone'),
  reraId: text('rera_id'),
  avatarUrl: text('avatar_url'),
  verified: boolean('verified').notNull().default(false),
  callPolicy: callPolicyEnum('call_policy').notNull().default('anyone_in_chat'),
  showApproxLocation: boolean('show_approx_location').notNull().default(true),
  pushToken: text('push_token'),
  createdAt: createdAt(),
});

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** sha256 of the opaque token; the raw token is never stored. */
    tokenHash: text('token_hash').notNull().unique(),
    /** All rotations of one login share a family; reuse of a revoked token kills the family. */
    family: uuid('family').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, precision: 3 }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, precision: 3 }),
    createdAt: createdAt(),
  },
  (t) => [index('refresh_tokens_family_idx').on(t.family)],
);

export const listings = pgTable(
  'listings',
  {
    id: id(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    landType: landTypeEnum('land_type').notNull(),
    area: doublePrecision('area').notNull(),
    areaUnit: areaUnitEnum('area_unit').notNull(),
    areaSqft: doublePrecision('area_sqft').notNull(),
    priceInr: bigint('price_inr', { mode: 'number' }).notNull(),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    locality: text('locality').notNull(),
    district: text('district').notNull().default(''),
    state: text('state').notNull().default(''),
    approxLocation: boolean('approx_location').notNull().default(true),
    roadAccessFt: integer('road_access_ft'),
    waterSource: text('water_source'),
    titleDocs: text('title_docs').array().notNull().default(sql`'{}'`),
    zoning: text('zoning'),
    images: text('images').array().notNull(),
    status: listingStatusEnum('status').notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index('listings_feed_idx').on(t.status, t.createdAt.desc(), t.id.desc()),
    index('listings_geo_idx').on(t.lat, t.lng),
    index('listings_owner_idx').on(t.ownerId),
  ],
);

export const savedListings = pgTable(
  'saved_listings',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] })],
);

export const conversations = pgTable('conversations', {
  id: id(),
  kind: convKindEnum('kind').notNull(),
  title: text('title'),
  listingId: uuid('listing_id').references(() => listings.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  /** "listingId:userA:userB" (sorted) so one buyer has one thread per listing. */
  directKey: text('direct_key').unique(),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
});

export const conversationMembers = pgTable(
  'conversation_members',
  {
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lastReadAt: timestamp('last_read_at', { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.userId] }), index('members_user_idx').on(t.userId)],
);

export const messages = pgTable(
  'messages',
  {
    id: id(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id').references(() => users.id, { onDelete: 'set null' }),
    kind: messageKindEnum('kind').notNull().default('text'),
    body: text('body').notNull(),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index('messages_conv_idx').on(t.conversationId, t.createdAt.desc())],
);

export const calls = pgTable(
  'calls',
  {
    id: id(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    callerId: uuid('caller_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    calleeId: uuid('callee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: callKindEnum('kind').notNull(),
    status: callStatusEnum('status').notNull().default('ringing'),
    roomName: text('room_name').notNull(),
    createdAt: createdAt(),
    answeredAt: timestamp('answered_at', { withTimezone: true, precision: 3 }),
    endedAt: timestamp('ended_at', { withTimezone: true, precision: 3 }),
  },
  (t) => [index('calls_caller_idx').on(t.callerId, t.createdAt.desc()), index('calls_callee_idx').on(t.calleeId, t.createdAt.desc())],
);

export const blocks = pgTable(
  'blocks',
  {
    blockerId: uuid('blocker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedId: uuid('blocked_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })],
);

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });

/**
 * Listing photos live in Postgres. ponytail: free-tier hosts wipe local disk on restart and this keeps
 * one vendor; client resizes to ~1600px JPEG (~250 KB). Move to S3/Supabase Storage + CDN past ~1 GB.
 */
export const uploads = pgTable('uploads', {
  id: id(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  mime: text('mime').notNull(),
  bytes: bytea('bytes').notNull(),
  createdAt: createdAt(),
});
