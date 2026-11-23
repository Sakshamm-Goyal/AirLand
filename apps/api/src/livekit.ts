import type { JoinInfo } from '@landconnect/shared';
import { AccessToken } from 'livekit-server-sdk';
import { config } from './config.ts';

/** Short-lived token scoped to one room. Our server decides who may join; LiveKit only carries media. */
export async function joinInfo(roomName: string, user: { id: string; name: string }): Promise<JoinInfo> {
  const at = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
    identity: user.id,
    name: user.name,
    ttl: '10m',
  });
  at.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });
  return { url: config.LIVEKIT_URL, token: await at.toJwt(), roomName };
}
