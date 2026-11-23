import type { Conversation } from '@landconnect/shared';

export const peerOf = (conv: Conversation, me: string) => conv.members.find((m) => m.id !== me) ?? conv.members[0]!;
export const convTitle = (conv: Conversation, me: string) => (conv.kind === 'room' ? (conv.title ?? 'Deal room') : peerOf(conv, me).name);
