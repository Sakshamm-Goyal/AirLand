/**
 * Expo push (FCM/APNs underneath). Used to wake a callee whose app is backgrounded.
 * ponytail: fire-and-forget, no receipts polling; add receipts if delivery needs auditing.
 */
export async function sendPush(to: string | null, title: string, body: string, data: Record<string, unknown>) {
  if (!to?.startsWith('ExponentPushToken')) return;
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to, title, body, data, priority: 'high', channelId: data.type === 'call' ? 'calls' : 'default', ttl: 30 }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Push is best-effort; the socket replay covers foreground delivery.
  }
}
