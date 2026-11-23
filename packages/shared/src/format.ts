import type { AreaUnit } from './schemas.ts';

export const SQFT_PER: Record<AreaUnit, number> = {
  sqft: 1,
  sqyd: 9,
  cent: 435.6,
  guntha: 1089,
  acre: 43_560,
  hectare: 107_639.1,
};

export const UNIT_LABEL: Record<AreaUnit, string> = {
  sqft: 'sq ft',
  sqyd: 'sq yd',
  cent: 'cent',
  guntha: 'guntha',
  acre: 'acre',
  hectare: 'hectare',
};

export const toSqft = (area: number, unit: AreaUnit) => Math.round(area * SQFT_PER[unit]);

const trim = (n: number) => String(Number(n.toFixed(2)));

/** ₹ 1.12 Cr · ₹ 58 L · ₹ 85,000 (Indian digit grouping). */
export function formatInr(rupees: number): string {
  if (rupees >= 1e7) return `₹ ${trim(rupees / 1e7)} Cr`;
  if (rupees >= 1e5) return `₹ ${trim(rupees / 1e5)} L`;
  return `₹ ${Math.round(rupees).toLocaleString('en-IN')}`;
}

/** 1,12,00,000 */
export const groupInr = (rupees: number) => Math.round(rupees).toLocaleString('en-IN');

export function formatArea(area: number, unit: AreaUnit): string {
  const label = UNIT_LABEL[unit];
  const plural = area !== 1 && (unit === 'acre' || unit === 'hectare' || unit === 'guntha' || unit === 'cent');
  return `${trim(area)} ${label}${plural ? 's' : ''}`;
}

/** "₹ 44.8 L / acre" */
export const formatPerUnit = (priceInr: number, area: number, unit: AreaUnit) => `${formatInr(priceInr / area)} / ${UNIT_LABEL[unit]}`;

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
