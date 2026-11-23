import type { Listing, Me, Message, PublicUser } from '@landconnect/shared';
import type { schema } from './db/client.ts';

type UserRow = typeof schema.users.$inferSelect;
type ListingRow = typeof schema.listings.$inferSelect;
type MessageRow = typeof schema.messages.$inferSelect;

/**
 * The ONLY way another user's data leaves the API. No phone, no email.
 * Tests assert this (test/api.test.ts "never leaks phone numbers").
 */
export const toPublicUser = (u: Pick<UserRow, 'id' | 'name' | 'role' | 'avatarUrl' | 'verified'>): PublicUser => ({
  id: u.id,
  name: u.name,
  role: u.role,
  avatarUrl: u.avatarUrl,
  verified: u.verified,
});

export const toMe = (u: UserRow): Me => ({
  ...toPublicUser(u),
  email: u.email,
  emailVerified: u.emailVerifiedAt !== null,
  phone: u.phone,
  reraId: u.reraId,
  callPolicy: u.callPolicy,
  showApproxLocation: u.showApproxLocation,
});

/** ~1.1 km precision: enough to browse, not enough to find the gate. */
const approx = (n: number) => Math.round(n * 100) / 100;

export function toListing(l: ListingRow, owner: UserRow, viewerId: string, saved = false): Listing {
  const isMine = l.ownerId === viewerId;
  const hide = l.approxLocation && !isMine;
  return {
    id: l.id,
    title: l.title,
    description: l.description,
    landType: l.landType,
    area: l.area,
    areaUnit: l.areaUnit,
    areaSqft: l.areaSqft,
    priceInr: l.priceInr,
    lat: hide ? approx(l.lat) : l.lat,
    lng: hide ? approx(l.lng) : l.lng,
    locality: l.locality,
    district: l.district,
    state: l.state,
    approxLocation: l.approxLocation,
    roadAccessFt: l.roadAccessFt,
    waterSource: l.waterSource as Listing['waterSource'],
    titleDocs: l.titleDocs,
    zoning: l.zoning,
    images: l.images,
    status: l.status,
    owner: toPublicUser(owner),
    isMine,
    saved,
    createdAt: l.createdAt.toISOString(),
  };
}

export const toMessage = (m: MessageRow, clientId?: string): Message => ({
  id: m.id,
  conversationId: m.conversationId,
  senderId: m.senderId,
  kind: m.kind,
  body: m.body,
  meta: m.meta ?? null,
  createdAt: m.createdAt.toISOString(),
  ...(clientId ? { clientId } : {}),
});
