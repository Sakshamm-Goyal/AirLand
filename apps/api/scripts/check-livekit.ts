/**
 * Verifies the configured LiveKit server (self-hosted or Cloud) accepts our credentials and room tokens.
 *   pnpm --filter api livekit:check
 * 1. Server API call with LIVEKIT_API_KEY/SECRET (list rooms).
 * 2. Mints a participant token exactly like a call accept does, and opens LiveKit's signalling socket with it:
 *    a valid token gets a JoinResponse frame; a bad one is rejected at the handshake.
 */
import { RoomServiceClient } from 'livekit-server-sdk';
import { config } from '../src/config.ts';
import { joinInfo } from '../src/livekit.ts';

const http = config.LIVEKIT_URL.replace(/^ws/, 'http');
const fail = (msg: string) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

console.log(`LiveKit: ${config.LIVEKIT_URL}`);
if (!config.LIVEKIT_API_SECRET) fail('LIVEKIT_API_SECRET is empty');

const svc = new RoomServiceClient(http, config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET);
try {
  const rooms = await svc.listRooms();
  console.log(`✓ server API accepted the key (${rooms.length} active rooms)`);
} catch (e) {
  fail(`server API rejected the key/secret or is unreachable: ${(e as Error).message}`);
}

const join = await joinInfo('lc_check_room', { id: 'check-user', name: 'Config check' });
const ws = new WebSocket(`${config.LIVEKIT_URL}/rtc?access_token=${join.token}&protocol=15&auto_subscribe=1`);
ws.binaryType = 'arraybuffer';
const ok = await new Promise<boolean>((resolve) => {
  const t = setTimeout(() => resolve(false), 8000);
  ws.onmessage = () => {
    clearTimeout(t);
    resolve(true);
  };
  ws.onerror = () => {
    clearTimeout(t);
    resolve(false);
  };
});
ws.close();
if (!ok) fail('participant token was not accepted by the signalling server');
console.log('✓ participant token accepted: a phone with this token can join a call room');
process.exit(0);
