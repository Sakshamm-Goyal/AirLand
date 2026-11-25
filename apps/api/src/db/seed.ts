/**
 * Demo data. Idempotent: wipes demo users (cascade) and recreates them.
 * Demo accounts (dev/demo only): buyer@demo.test · seller@demo.test · broker@demo.test, password below.
 */
import { type ListingInput, toSqft } from '@landconnect/shared';
import { inArray, sql as q } from 'drizzle-orm';
import { hashPassword } from '../auth.ts';
import { db, schema, sql } from './client.ts';

export const DEMO_PASSWORD = 'landconnect123';
const emails = ['buyer@demo.test', 'seller@demo.test', 'broker@demo.test', 'seller2@demo.test'];

await db.delete(schema.users).where(inArray(schema.users.email, emails));
// Conversations outlive their members (created_by is set null), so drop the ones nobody is left in.
await db.execute(q`delete from conversations c where not exists (select 1 from conversation_members m where m.conversation_id = c.id)`);
const passwordHash = await hashPassword(DEMO_PASSWORD);
const emailVerifiedAt = new Date(); // demo accounts skip the emailed code
const [buyer, seller, broker, seller2] = await db
  .insert(schema.users)
  .values([
    { email: emails[0]!, name: 'Asha Sharma', role: 'buyer', phone: '+919800000001', passwordHash, emailVerifiedAt },
    { email: emails[1]!, name: 'Ramesh Kumar', role: 'seller', phone: '+919800000002', passwordHash, emailVerifiedAt, verified: true },
    {
      email: emails[2]!,
      name: 'Priya Nair',
      role: 'broker',
      phone: '+919800000003',
      reraId: 'PRM/KA/RERA/1251/309',
      passwordHash,
      emailVerifiedAt,
      verified: true,
    },
    { email: emails[3]!, name: 'Suresh Reddy', role: 'seller', phone: '+919800000004', passwordHash, emailVerifiedAt },
  ])
  .returning();

// Hand-picked land photos (Unsplash via Picsum, stable by id), a different lead photo per plot that fits its land type.
const img = (...ids: number[]) => ids.map((id) => `https://picsum.photos/id/${id}/1200/800`);

const data: [string, ListingInput][] = [
  [
    seller!.id,
    {
      title: '2.5 acre farmland near Devanahalli',
      description:
        'Red soil, fenced on three sides, two borewells with good yield. 12 km from the airport. Clear title, RTC in seller name.',
      landType: 'agricultural',
      area: 2.5,
      areaUnit: 'acre',
      priceInr: 11_200_000,
      lat: 13.2468,
      lng: 77.7116,
      locality: 'Devanahalli',
      district: 'Bengaluru Rural',
      state: 'Karnataka',
      roadAccessFt: 30,
      waterSource: 'borewell',
      titleDocs: ['RTC', 'EC', 'Mutation'],
      zoning: 'Agricultural',
      images: img(85, 110, 337, 107),
    },
  ],
  [
    broker!.id,
    {
      title: 'East-facing BMRDA approved plot, Sarjapur Road',
      description: 'Gated layout with tar roads, underground drainage and street lights. Ready for construction.',
      landType: 'residential',
      area: 2400,
      areaUnit: 'sqft',
      priceInr: 5_800_000,
      lat: 12.8606,
      lng: 77.7865,
      locality: 'Sarjapur Road',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
      roadAccessFt: 40,
      waterSource: 'municipal',
      titleDocs: ['Khata', 'EC'],
      zoning: 'Residential',
      images: img(255, 542, 17, 277),
    },
  ],
  [
    seller2!.id,
    {
      title: 'Mango orchard with farmhouse, Chevella',
      description: '180 grafted Banganapalli trees, 12 years old. 1,200 sq ft farmhouse, drip irrigation throughout.',
      landType: 'farmhouse',
      area: 5,
      areaUnit: 'acre',
      priceInr: 32_500_000,
      lat: 17.3069,
      lng: 78.1353,
      locality: 'Chevella',
      district: 'Ranga Reddy',
      state: 'Telangana',
      roadAccessFt: 24,
      waterSource: 'borewell',
      titleDocs: ['Pahani', 'Passbook', 'EC'],
      zoning: 'Agricultural',
      images: img(206, 517, 468, 18),
    },
  ],
  [
    broker!.id,
    {
      title: 'Highway-facing commercial land, Hosur Road',
      description: '160 ft frontage on NH 44. Suits a showroom, warehouse or fuel station.',
      landType: 'commercial',
      area: 20,
      areaUnit: 'guntha',
      priceInr: 48_000_000,
      lat: 12.7409,
      lng: 77.8253,
      locality: 'Attibele',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
      roadAccessFt: 100,
      waterSource: 'borewell',
      titleDocs: ['RTC', 'DC Conversion', 'EC'],
      zoning: 'Commercial',
      images: img(165, 347, 492, 330),
    },
  ],
  [
    seller!.id,
    {
      title: 'Coconut plantation by the backwaters',
      description: 'Mature coconut grove with canal access. Ideal for a homestay.',
      landType: 'plantation',
      area: 85,
      areaUnit: 'cent',
      priceInr: 7_400_000,
      lat: 9.4981,
      lng: 76.3388,
      locality: 'Kumarakom',
      district: 'Kottayam',
      state: 'Kerala',
      roadAccessFt: 12,
      waterSource: 'canal',
      titleDocs: ['Thandaper', 'EC'],
      zoning: null,
      images: img(174, 128, 380, 93),
    },
  ],
  [
    seller2!.id,
    {
      title: 'Industrial plot in MIDC Chakan',
      description: 'Leveled plot, 3-phase power at boundary, close to auto cluster.',
      landType: 'industrial',
      area: 1,
      areaUnit: 'hectare',
      priceInr: 95_000_000,
      lat: 18.7606,
      lng: 73.8636,
      locality: 'Chakan',
      district: 'Pune',
      state: 'Maharashtra',
      roadAccessFt: 60,
      waterSource: 'municipal',
      titleDocs: ['7/12', 'EC'],
      zoning: 'Industrial',
      images: img(141, 112, 62, 484),
    },
  ],
  [
    broker!.id,
    {
      title: 'Weekend farm plot near Mulshi lake',
      description: 'Hill-view plot with a seasonal stream. 45 minutes from Hinjewadi.',
      landType: 'agricultural',
      area: 10,
      areaUnit: 'guntha',
      priceInr: 3_900_000,
      lat: 18.5133,
      lng: 73.5136,
      locality: 'Mulshi',
      district: 'Pune',
      state: 'Maharashtra',
      roadAccessFt: 15,
      waterSource: 'river',
      titleDocs: ['7/12'],
      zoning: 'Agricultural',
      images: img(287, 480, 116, 28),
    },
  ],
  [
    seller!.id,
    {
      title: 'Corner residential site, Mysuru Ring Road',
      description: '40×60 corner site in a DTCP approved layout, park facing.',
      landType: 'residential',
      area: 267,
      areaUnit: 'sqyd',
      priceInr: 9_600_000,
      lat: 12.3375,
      lng: 76.6094,
      locality: 'Vijayanagar 4th Stage',
      district: 'Mysuru',
      state: 'Karnataka',
      roadAccessFt: 40,
      waterSource: 'municipal',
      titleDocs: ['Khata', 'EC'],
      zoning: 'Residential',
      images: img(277, 17, 127, 542),
    },
  ],
];

const NOW = Date.now(); // one clock for the whole seed, so read markers and messages line up exactly
const ago = (minutes: number) => new Date(NOW - minutes * 60_000);
const DAY = 1440;

const listings = await db
  .insert(schema.listings)
  .values(
    data.map(([ownerId, l], i) => ({
      ...l,
      description: l.description ?? '',
      ownerId,
      areaSqft: toSqft(l.area, l.areaUnit),
      createdAt: ago(4 * DAY + i * 11 * 60), // first in the list = newest = top of the feed
    })),
  )
  .returning({ id: schema.listings.id });
const [devanahalli, sarjapur, chevella, , kumarakom, , mulshi] = listings.map((l) => l.id);

// ── Conversations: what a few days of real use looks like ─────────────────
type Line = [minutesAgo: number, from: string | null, body: string] | [number, string, 'call', 'audio' | 'video', string, number?];
const intro = (title: string) => `Enquiry about “${title}”. Phone numbers stay hidden. Chat and call right here.`;

async function thread(
  opts: { listingId?: string; title?: string; createdBy: string; members: string[]; kind?: 'direct' | 'room' },
  lines: Line[],
  readAt: Record<string, number>,
) {
  const kind = opts.kind ?? 'direct';
  const last = Math.min(...lines.map((l) => l[0]));
  const [conv] = await db
    .insert(schema.conversations)
    .values({
      kind,
      title: opts.title ?? null,
      listingId: opts.listingId ?? null,
      createdBy: opts.createdBy,
      directKey: kind === 'direct' ? `${opts.listingId}:${[...opts.members].sort().join(':')}` : null,
      createdAt: ago(Math.max(...lines.map((l) => l[0]))),
      updatedAt: ago(last),
    })
    .returning();
  await db
    .insert(schema.conversationMembers)
    .values(opts.members.map((userId) => ({ conversationId: conv!.id, userId, lastReadAt: ago(readAt[userId] ?? last) })));
  for (const line of lines) {
    const [min, from] = line;
    if (line[2] === 'call') {
      const [, caller, , callKind, status, secs] = line as [number, string, 'call', 'audio' | 'video', string, number?];
      const callee = opts.members.find((m) => m !== caller)!;
      const [call] = await db
        .insert(schema.calls)
        .values({
          conversationId: conv!.id,
          callerId: caller,
          calleeId: callee,
          kind: callKind,
          status: status as 'ended' | 'missed' | 'rejected',
          roomName: `call_seed_${conv!.id.slice(0, 8)}_${min}`,
          createdAt: ago(min),
          answeredAt: secs ? ago(min) : null,
          endedAt: new Date(ago(min).getTime() + (secs ?? 30) * 1000),
        })
        .returning();
      const K = callKind === 'video' ? 'Video' : 'Voice';
      const body =
        status === 'ended'
          ? `${K} call · ${Math.floor(secs! / 60)}:${String(secs! % 60).padStart(2, '0')}`
          : status === 'missed'
            ? `Missed ${K.toLowerCase()} call`
            : `${K} call declined`;
      await db.insert(schema.messages).values({
        conversationId: conv!.id,
        senderId: caller,
        kind: 'call',
        body,
        meta: { kind: callKind, status, durationSec: secs ?? null, callId: call!.id },
        createdAt: ago(min),
      });
    } else {
      await db
        .insert(schema.messages)
        .values({ conversationId: conv!.id, senderId: from, kind: from ? 'text' : 'system', body: line[2], createdAt: ago(min) });
    }
  }
  return conv!;
}

const A = buyer!.id;
const R = seller!.id;
const P = broker!.id;
const S = seller2!.id;

await thread(
  { listingId: devanahalli, createdBy: A, members: [A, R] },
  [
    [3 * DAY, null, intro('2.5 acre farmland near Devanahalli')],
    [3 * DAY - 1, A, 'Namaste Ramesh ji, is the Devanahalli farmland still available?'],
    [3 * DAY - 9, R, 'Yes, all 2.5 acres. Fenced on three sides, two borewells with good yield.'],
    [3 * DAY - 14, A, 'Is the price negotiable? And are the RTC and EC up to date?'],
    [3 * DAY - 31, R, 'RTC is in my name and the EC is clear for 30 years. There is some room on price for a quick registration.'],
    [2 * DAY + 300, A, 'call', 'video', 'ended', 402],
    [2 * DAY + 290, A, 'Thank you for the video walkthrough. The soil looks good.'],
    [DAY + 120, R, 'Sharing the RTC and EC copies here before the visit.'],
    [DAY + 100, A, 'Can I come on Saturday morning to see it in person?'],
    [DAY + 95, R, 'Saturday 10 am works. I will share the exact pin when you are close.'],
    [40, A, 'Perfect, see you at the gate on Saturday.'],
  ],
  { [R]: 90 },
); // Ramesh hasn't read Asha's last message yet: an unread badge for the demo

await thread(
  { listingId: sarjapur, createdBy: A, members: [A, P] },
  [
    [2 * DAY, null, intro('East-facing BMRDA approved plot, Sarjapur Road')],
    [2 * DAY - 2, A, 'Hi Priya, what is the approval status of the Sarjapur plot?'],
    [2 * DAY - 20, P, 'BMRDA approved with A-khata. East-facing, 40x60, in a gated layout.'],
    [DAY + 400, P, 'call', 'audio', 'missed'],
    [DAY + 398, P, 'Tried calling you. The owner can do ₹55 lakh if we close this month.'],
    [DAY + 200, A, 'Sorry, I was in a meeting. Let me discuss with my family and get back by Friday.'],
  ],
  {},
);

await thread(
  { listingId: kumarakom, createdBy: P, members: [P, R] },
  [
    [DAY + 600, null, intro('Coconut plantation by the backwaters')],
    [DAY + 598, P, 'I have a client from Kochi looking for a coconut plantation. Is yours on the main road?'],
    [DAY + 560, R, 'About 200 m from the main road, with a 20 ft approach road.'],
    [DAY + 500, P, 'call', 'audio', 'ended', 198],
    [DAY + 495, P, 'Thanks Ramesh ji. I will bring my client next week.'],
  ],
  {},
);

await thread(
  { listingId: chevella, createdBy: A, members: [A, S] },
  [
    [DAY - 60, null, intro('Mango orchard with farmhouse, Chevella')],
    [DAY - 62, A, 'How many mango trees are on the orchard, and what was last season’s yield?'],
    [DAY - 80, S, 'About 180 trees, mostly Banganapalli. Last season was around 9 tonnes.'],
    [DAY - 150, A, 'call', 'video', 'rejected'],
    [DAY - 151, S, 'In a meeting, please message me.'],
  ],
  {},
);

const roomTitle = 'Devanahalli site visit, Saturday';
await thread(
  { kind: 'room', title: roomTitle, listingId: devanahalli, createdBy: R, members: [R, A, P] },
  [
    [DAY + 60, null, `${roomTitle} created. Start a meeting from the header when everyone is ready.`],
    [DAY + 58, R, 'Created this room so we can plan Saturday’s visit together.'],
    [DAY + 30, P, 'I will bring the survey sketch and the conversion documents.'],
    [DAY + 20, A, 'Great. 10 am at the gate works for me.'],
  ],
  {},
);

await db.insert(schema.savedListings).values([devanahalli, chevella, mulshi].map((listingId) => ({ userId: A, listingId: listingId! })));

console.log(
  `seeded 4 users (password: ${DEMO_PASSWORD}), ${data.length} listings, 5 conversations with calls, saved plots and a deal room`,
);
await sql.end();
