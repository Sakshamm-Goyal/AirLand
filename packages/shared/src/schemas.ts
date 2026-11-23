import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────────────────
export const ROLES = ['buyer', 'seller', 'broker'] as const;
export const LAND_TYPES = ['agricultural', 'residential', 'commercial', 'industrial', 'farmhouse', 'plantation'] as const;
export const AREA_UNITS = ['acre', 'guntha', 'cent', 'sqft', 'sqyd', 'hectare'] as const;
export const WATER_SOURCES = ['borewell', 'canal', 'river', 'lake', 'municipal', 'none'] as const;
export const CALL_POLICIES = ['anyone_in_chat', 'nobody'] as const;
export const CALL_KINDS = ['audio', 'video'] as const;
export const CALL_STATUSES = ['ringing', 'accepted', 'rejected', 'cancelled', 'missed', 'busy', 'ended'] as const;

export type Role = (typeof ROLES)[number];
export type LandType = (typeof LAND_TYPES)[number];
export type AreaUnit = (typeof AREA_UNITS)[number];
export type CallKind = (typeof CALL_KINDS)[number];
export type CallStatus = (typeof CALL_STATUSES)[number];
export type CallPolicy = (typeof CALL_POLICIES)[number];

// ── Auth ─────────────────────────────────────────────────────────────────
const email = z.email().trim().toLowerCase().max(254);
const password = z.string().min(8, 'At least 8 characters').max(128);

export const signUpSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your name').max(60),
    email,
    password,
    role: z.enum(ROLES),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{10,14}$/, 'Enter a valid phone number')
      .optional(),
    reraId: z.string().trim().max(40).optional(),
  })
  .refine((v) => v.role !== 'broker' || (v.reraId?.length ?? 0) >= 4, {
    path: ['reraId'],
    message: 'Brokers need a RERA registration number',
  });
export type SignUpInput = z.infer<typeof signUpSchema>;

export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200) });

// ── Users ────────────────────────────────────────────────────────────────
/** What other people may see about a user. Never contains phone or email. */
export interface PublicUser {
  id: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
  verified: boolean;
}

export interface Me extends PublicUser {
  email: string;
  phone: string | null;
  reraId: string | null;
  callPolicy: CallPolicy;
  showApproxLocation: boolean;
}

export const updateMeSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  callPolicy: z.enum(CALL_POLICIES).optional(),
  showApproxLocation: z.boolean().optional(),
  pushToken: z.string().max(200).nullable().optional(),
});

export interface AuthResponse {
  user: Me;
  accessToken: string;
  refreshToken: string;
}

// ── Listings ─────────────────────────────────────────────────────────────
export const listingInputSchema = z.object({
  title: z.string().trim().min(8, 'Give it a clear title').max(120),
  description: z.string().trim().max(4000).default(''),
  landType: z.enum(LAND_TYPES),
  area: z.number().positive('Area must be more than 0').max(1e9),
  areaUnit: z.enum(AREA_UNITS),
  priceInr: z.number().int().positive('Enter a price').max(1e12),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  locality: z.string().trim().min(2, 'Add the village or locality').max(120),
  district: z.string().trim().max(80).default(''),
  state: z.string().trim().max(60).default(''),
  approxLocation: z.boolean().default(true),
  roadAccessFt: z.number().int().min(0).max(500).nullable().default(null),
  waterSource: z.enum(WATER_SOURCES).nullable().default(null),
  titleDocs: z.array(z.string().trim().max(40)).max(8).default([]),
  zoning: z.string().trim().max(40).nullable().default(null),
  images: z.array(z.url()).min(1, 'Add at least one photo').max(10),
});
export type ListingInput = z.input<typeof listingInputSchema>;

export const listingQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  type: z.enum(LAND_TYPES).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  /** Map viewport: "minLng,minLat,maxLng,maxLat" */
  bbox: z
    .string()
    .regex(/^-?[\d.]+,-?[\d.]+,-?[\d.]+,-?[\d.]+$/)
    .optional(),
  owner: z.enum(['me']).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListingQuery = z.input<typeof listingQuerySchema>;

export interface Listing {
  id: string;
  title: string;
  description: string;
  landType: LandType;
  area: number;
  areaUnit: AreaUnit;
  areaSqft: number;
  priceInr: number;
  /** Rounded to ~1 km when the owner chose an approximate location. */
  lat: number;
  lng: number;
  locality: string;
  district: string;
  state: string;
  approxLocation: boolean;
  roadAccessFt: number | null;
  waterSource: (typeof WATER_SOURCES)[number] | null;
  titleDocs: string[];
  zoning: string | null;
  images: string[];
  status: 'active' | 'sold';
  owner: PublicUser;
  isMine: boolean;
  saved: boolean;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

// ── Conversations & messages ─────────────────────────────────────────────
export interface ListingStub {
  id: string;
  title: string;
  priceInr: number;
  image: string | null;
  locality: string;
}

export interface Conversation {
  id: string;
  kind: 'direct' | 'room';
  title: string | null;
  listing: ListingStub | null;
  members: PublicUser[];
  lastMessage: Message | null;
  unread: number;
  updatedAt: string;
}

export type MessageKind = 'text' | 'system' | 'call';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string | null;
  kind: MessageKind;
  body: string;
  /** For kind=call: { kind, status, durationSec } */
  meta: Record<string, unknown> | null;
  createdAt: string;
  /** Echoed back so the sender can reconcile its optimistic bubble. */
  clientId?: string;
}

export const startConversationSchema = z.object({ listingId: z.uuid() });
export const createRoomSchema = z.object({
  title: z.string().trim().min(3).max(60),
  listingId: z.uuid().nullable().default(null),
  memberIds: z.array(z.uuid()).min(1).max(7),
});
export const messagesQuerySchema = z.object({
  before: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

// ── Calls ────────────────────────────────────────────────────────────────
export interface CallLogEntry {
  id: string;
  conversationId: string;
  kind: CallKind;
  status: CallStatus;
  direction: 'outgoing' | 'incoming';
  peer: PublicUser;
  startedAt: string;
  durationSec: number | null;
}

/** Everything a client needs to join the media room. */
export interface JoinInfo {
  url: string;
  token: string;
  roomName: string;
}
