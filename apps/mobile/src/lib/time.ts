/** "now", "5m", "3h", "2d", "12 Nov" */
export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)}d`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Chat list time: 14:05 today, "Yesterday", weekday, or date. */
export function chatTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const days = Math.floor((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (days === 0) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString('en-IN', { weekday: 'short' });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export const clockTime = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
