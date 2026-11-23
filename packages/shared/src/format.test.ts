import { describe, expect, it } from 'vitest';
import { formatArea, formatDuration, formatInr, formatPerUnit, groupInr, toSqft } from './format.ts';
import { signUpSchema } from './schemas.ts';

describe('format', () => {
  it('formats rupees the Indian way', () => {
    expect(formatInr(11_200_000)).toBe('₹ 1.12 Cr');
    expect(formatInr(5_800_000)).toBe('₹ 58 L');
    expect(formatInr(85_000)).toBe('₹ 85,000');
    expect(groupInr(11_200_000)).toBe('1,12,00,000');
  });
  it('converts land units', () => {
    expect(toSqft(2.5, 'acre')).toBe(108_900);
    expect(toSqft(1, 'guntha')).toBe(1089);
    expect(formatArea(2.5, 'acre')).toBe('2.5 acres');
    expect(formatPerUnit(11_200_000, 2.5, 'acre')).toBe('₹ 44.8 L / acre');
  });
  it('formats call duration', () => expect(formatDuration(134)).toBe('2:14'));
  it('requires a RERA id for brokers only', () => {
    const base = { name: 'Asha', email: 'A@x.in', password: 'password1' };
    expect(signUpSchema.safeParse({ ...base, role: 'buyer' }).success).toBe(true);
    expect(signUpSchema.safeParse({ ...base, role: 'broker' }).success).toBe(false);
    expect(signUpSchema.parse({ ...base, role: 'broker', reraId: 'PRM/KA/1' }).email).toBe('a@x.in');
  });
});
