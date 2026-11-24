import { describe, expect, it } from 'vitest';
import { changeRoleSchema, listingInputSchema, signUpSchema, socketSchemas } from './schemas.ts';

const user = { email: 'a@b.co', password: 'password123', role: 'buyer' as const };
const listing = {
  title: 'Two acre farm near the lake',
  landType: 'agricultural' as const,
  area: 2,
  areaUnit: 'acre' as const,
  priceInr: 9_000_000,
  lat: 12.3,
  lng: 77.6,
  locality: 'Chevella',
  images: ['https://x.test/a.jpg'],
};

describe('text rules', () => {
  it('names: any script, no digits or emoji', () => {
    for (const ok of ['Asha Sharma', 'आशा शर्मा', 'ಆಶಾ', "D'Souza-Rao", 'Dr. K. Rao'])
      expect(signUpSchema.safeParse({ ...user, name: ok }).success, ok).toBe(true);
    for (const bad of ['Asha 😀', 'Asha2', '🙂🙂', '<b>x</b>'])
      expect(signUpSchema.safeParse({ ...user, name: bad }).success, bad).toBe(false);
  });

  it('listing title and places refuse emoji; description allows them', () => {
    expect(listingInputSchema.safeParse(listing).success).toBe(true);
    expect(listingInputSchema.safeParse({ ...listing, title: 'Farm 🌾 near the lake' }).success).toBe(false);
    expect(listingInputSchema.safeParse({ ...listing, locality: 'Chevella 🏡' }).success).toBe(false);
    expect(listingInputSchema.safeParse({ ...listing, description: 'Mango trees 🥭 and a borewell' }).success).toBe(true);
  });

  it('hard numeric limits', () => {
    expect(listingInputSchema.safeParse({ ...listing, priceInr: 1e13 }).success).toBe(false);
    expect(listingInputSchema.safeParse({ ...listing, area: 0 }).success).toBe(false);
    expect(listingInputSchema.safeParse({ ...listing, roadAccessFt: 501 }).success).toBe(false);
    expect(listingInputSchema.safeParse({ ...listing, images: [] }).success).toBe(false);
    expect(listingInputSchema.safeParse({ ...listing, images: Array(11).fill('https://x.test/a.jpg') }).success).toBe(false);
  });

  it('RERA numbers: letters, digits, / and -', () => {
    expect(changeRoleSchema.safeParse({ role: 'broker', reraId: 'PRM/KA/RERA/1251/309' }).success).toBe(true);
    expect(changeRoleSchema.safeParse({ role: 'broker', reraId: 'RERA😀1234' }).success).toBe(false);
  });

  it('chat allows emoji but caps length', () => {
    const conv = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
    expect(socketSchemas['message:send'].safeParse({ conversationId: conv, body: 'Deal 🤝', clientId: 'c' }).success).toBe(true);
    expect(socketSchemas['message:send'].safeParse({ conversationId: conv, body: 'x'.repeat(4001), clientId: 'c' }).success).toBe(false);
    expect(socketSchemas['message:send'].safeParse({ conversationId: conv, body: '   ', clientId: 'c' }).success).toBe(false);
  });
});
