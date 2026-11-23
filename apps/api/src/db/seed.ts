/**
 * Demo data. Idempotent: wipes demo users (cascade) and recreates them.
 * Demo accounts (dev/demo only): buyer@demo.test · seller@demo.test · broker@demo.test, password below.
 */
import { type ListingInput, toSqft } from '@landconnect/shared';
import { inArray } from 'drizzle-orm';
import { hashPassword } from '../auth.ts';
import { db, schema, sql } from './client.ts';

export const DEMO_PASSWORD = 'landconnect123';
const emails = ['buyer@demo.test', 'seller@demo.test', 'broker@demo.test', 'seller2@demo.test'];

await db.delete(schema.users).where(inArray(schema.users.email, emails));
const passwordHash = await hashPassword(DEMO_PASSWORD);
const [buyer, seller, broker, seller2] = await db
  .insert(schema.users)
  .values([
    { email: emails[0]!, name: 'Asha Sharma', role: 'buyer', phone: '+919800000001', passwordHash },
    { email: emails[1]!, name: 'Ramesh Kumar', role: 'seller', phone: '+919800000002', passwordHash, verified: true },
    {
      email: emails[2]!,
      name: 'Priya Brokers',
      role: 'broker',
      phone: '+919800000003',
      reraId: 'PRM/KA/RERA/1251/309',
      passwordHash,
      verified: true,
    },
    { email: emails[3]!, name: 'Suresh Reddy', role: 'seller', phone: '+919800000004', passwordHash },
  ])
  .returning();

const img = (seed: string, n = 4) => Array.from({ length: n }, (_, i) => `https://picsum.photos/seed/lc-${seed}-${i}/1200/800`);

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
      images: img('devanahalli'),
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
      images: img('sarjapur'),
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
      images: img('chevella'),
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
      images: img('hosur'),
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
      images: img('kumarakom'),
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
      images: img('chakan'),
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
      images: img('mulshi'),
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
      images: img('mysuru'),
    },
  ],
];

await db.insert(schema.listings).values(
  data.map(([ownerId, l], i) => ({
    ...l,
    description: l.description ?? '',
    ownerId,
    areaSqft: toSqft(l.area, l.areaUnit),
    createdAt: new Date(Date.now() - i * 7 * 3600_000),
  })),
);

console.log(`seeded 4 users (password: ${DEMO_PASSWORD}) and ${data.length} listings; buyer ${buyer!.id}`);
await sql.end();
