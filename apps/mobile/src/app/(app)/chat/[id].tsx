import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { formatInr, type Message } from '@landconnect/shared';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  EllipsisVertical,
  LandPlot,
  Lock,
  LogOut,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  ShieldBan,
  ShieldCheck,
  Users,
  Video,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { Avatar, Button, IconButton, RoleBadge, Text } from '@/components/ui';
import { calls } from '@/features/calls/store';
import { convTitle, peerOf } from '@/lib/conversation';
import { upsertMessage, useBlocks, useConversation, useLeaveRoom, useMessages, useSetBlocked } from '@/lib/queries';
import { activeChat, usePresence, useTyping } from '@/lib/realtime';
import { useSession } from '@/lib/session';
import { emitAck, getSocket } from '@/lib/socket';
import { clockTime, dayLabel, sameDay } from '@/lib/time';
import { gutter, makeStyles, radius, type, useTheme } from '@/theme';

type UiMessage = Message & { pending?: boolean; failed?: boolean };

// One-tap openers for the first message: what the person enquiring asks vs what the listing owner answers.
const STARTERS = {
  asker: ['Is the price negotiable?', 'Can I visit this weekend?', 'Are the title documents clear?', 'Is there road access?'],
  owner: ["Yes, it's still available.", 'When would you like to visit?', 'I can share the documents here.'],
};

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useStyles();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const me = useSession((st) => st.user!.id);
  const myRole = useSession((st) => st.user!.role);
  const sheet = useRef<BottomSheetModal>(null);
  const membersSheet = useRef<BottomSheetModal>(null);
  const presence = usePresence((p) => p);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const leave = useLeaveRoom(id);
  const conv = useConversation(id).data;
  const msgs = useMessages(id);
  const typingUser = useTyping((t) => t[id]);
  const [text, setText] = useState('');
  const setBlocked = useSetBlocked();
  const blocks = useBlocks().data;
  const items: UiMessage[] = msgs.data?.pages.flat() ?? [];

  const peer = conv ? peerOf(conv, me) : null;
  const online = usePresence((p) => (peer ? p[peer.id] : false));

  // No in-app banner for the chat you're looking at.
  useFocusEffect(
    useCallback(() => {
      activeChat.id = id;
      return () => {
        if (activeChat.id === id) activeChat.id = null;
      };
    }, [id]),
  );
  const list = useRef<FlashListRef<UiMessage>>(null);
  const atBottom = useRef(true);

  // A new newest message: mark read, and follow it if I sent it or I'm already reading the bottom.
  // (FlashList keeps the visible rows still when a row is added at the start, so it won't scroll by itself.)
  const newest = items[0]?.id;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `newest` is the trigger
  useEffect(() => {
    getSocket().emit('conv:read', { conversationId: id });
    if (newest && (items[0]?.senderId === me || atBottom.current)) {
      requestAnimationFrame(() => list.current?.scrollToOffset({ offset: 0, animated: true }));
    }
  }, [id, newest]);

  const send = async (body = text.trim(), retryOf?: UiMessage) => {
    if (!body) return;
    const clientId = retryOf?.clientId ?? `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    if (!retryOf) setText('');
    upsertMessage({
      id: clientId,
      clientId,
      conversationId: id,
      senderId: me,
      kind: 'text',
      body,
      meta: null,
      createdAt: new Date().toISOString(),
      pending: true,
    } as UiMessage);
    try {
      await emitAck<Message>('message:send', { conversationId: id, body, clientId });
    } catch (e) {
      upsertMessage({
        id: clientId,
        clientId,
        conversationId: id,
        senderId: me,
        kind: 'text',
        body,
        meta: null,
        createdAt: new Date().toISOString(),
        failed: true,
      } as UiMessage);
      toast.error((e as Error).message);
    }
  };

  const lastTyping = useRef(0);
  const onType = (v: string) => {
    setText(v);
    if (Date.now() - lastTyping.current > 2000) {
      lastTyping.current = Date.now();
      getSocket().emit('typing', { conversationId: id });
    }
  };

  const isRoom = conv?.kind === 'room';
  const iBlocked = !!peer && !isRoom && !!blocks?.some((u) => u.id === peer.id);
  const block = (blocked: boolean) =>
    peer &&
    setBlocked.mutate(
      { userId: peer.id, blocked },
      {
        onSuccess: () => {
          sheet.current?.dismiss();
          if (blocked) toast(`${peer.name} is blocked`, { description: "They can't message or call you. Unblock any time." });
          else toast.success(`${peer.name} is unblocked`);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <IconButton icon={ChevronLeft} label="Back" variant="plain" onPress={() => router.back()} />
        {conv && peer ? (
          <>
            {isRoom ? (
              <View style={s.roomIcon}>
                <Users size={20} color={c.brand} />
              </View>
            ) : (
              <View>
                <Avatar name={peer.name} uri={peer.avatarUrl} size={40} />
                {online ? <View style={s.onlineDot} accessibilityLabel="Online" /> : null}
              </View>
            )}
            <Pressable
              style={{ flex: 1 }}
              disabled={!isRoom}
              onPress={() => membersSheet.current?.present()}
              accessibilityRole={isRoom ? 'button' : undefined}
              accessibilityLabel={isRoom ? `${convTitle(conv, me)}, ${conv.members.length} members. Show members` : undefined}
            >
              <Text variant="h2" numberOfLines={1}>
                {convTitle(conv, me)}
              </Text>
              {isRoom ? (
                <Text variant="small" color="muted">
                  {conv.members.length} members · tap for info
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <RoleBadge role={peer.role} verified={peer.verified} />
                  <Text variant="small" color={typingUser ? 'brand' : 'muted'}>
                    {typingUser ? 'typing…' : online ? 'online' : ''}
                  </Text>
                </View>
              )}
            </Pressable>
            {isRoom ? (
              <Button
                title="Join"
                icon={Video}
                size="md"
                kind="brand"
                onPress={() => router.push({ pathname: '/room/[id]', params: { id } })}
              />
            ) : (
              <>
                {iBlocked ? null : (
                  <>
                    <IconButton
                      icon={Phone}
                      label={`Voice call ${peer.name}`}
                      variant="plain"
                      onPress={() => calls.start(id, 'audio', peer, conv.listing?.title ?? null)}
                    />
                    <IconButton
                      icon={Video}
                      label={`Video call ${peer.name}`}
                      variant="plain"
                      onPress={() => calls.start(id, 'video', peer, conv.listing?.title ?? null)}
                    />
                  </>
                )}
                <IconButton
                  icon={EllipsisVertical}
                  label="More options"
                  variant="plain"
                  size={36}
                  onPress={() => {
                    setConfirmBlock(false);
                    sheet.current?.present();
                  }}
                />
              </>
            )}
          </>
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </View>

      {conv?.listing ? (
        <Pressable
          style={s.pinned}
          onPress={() => router.push({ pathname: '/listing/[id]', params: { id: conv.listing!.id } })}
          accessibilityRole="button"
          accessibilityLabel={`Open listing ${conv.listing.title}`}
        >
          <Image source={conv.listing.image} style={s.pinnedImg} contentFit="cover" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" color="muted">
              Enquiry about
            </Text>
            <Text variant="smallMedium" numberOfLines={1}>
              {conv.listing.title}
            </Text>
            <Text variant="small" numberOfLines={1}>
              <Text variant="smallMedium" color="accent">
                {formatInr(conv.listing.priceInr)}
              </Text>
              <Text variant="small" color="muted">
                {' '}
                · {conv.listing.locality}
              </Text>
            </Text>
          </View>
          <ChevronRight size={20} color={c.muted} />
        </Pressable>
      ) : null}

      {/* The list shrinks with the keyboard, so the newest messages stay visible and older ones scroll. */}
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={-insets.bottom} style={{ flex: 1 }}>
        <FlashList
          ref={list}
          data={items}
          inverted
          keyExtractor={(m) => m.clientId ?? m.id}
          renderItem={({ item, index }) => (
            <View>
              {/* Inverted list: the separator goes above the first message of each day, i.e. when the older one differs. */}
              {!items[index + 1] || !sameDay(items[index + 1]!.createdAt, item.createdAt) ? (
                <View style={s.day}>
                  <Text variant="micro" color="muted">
                    {dayLabel(item.createdAt)}
                  </Text>
                </View>
              ) : null}
              <Bubble
                m={item}
                mine={item.senderId === me}
                grouped={
                  items[index + 1]?.senderId === item.senderId &&
                  items[index + 1]?.kind === 'text' &&
                  sameDay(items[index + 1]!.createdAt, item.createdAt)
                }
                onRetry={() => send(item.body, item)}
                onCallBack={peer && !isRoom && !iBlocked ? (kind) => calls.start(id, kind, peer, conv?.listing?.title ?? null) : undefined}
              />
            </View>
          )}
          onEndReached={() => msgs.hasNextPage && !msgs.isFetchingNextPage && msgs.fetchNextPage()}
          contentContainerStyle={{ paddingHorizontal: gutter, paddingVertical: 12 }}
          keyboardDismissMode="interactive"
          // Inverted: offset 0 is the newest message at the bottom.
          onScroll={(e) => {
            atBottom.current = e.nativeEvent.contentOffset.y < 120;
          }}
          scrollEventThrottle={100}
        />

        {iBlocked ? (
          <View style={[s.blockedBar, { paddingBottom: insets.bottom + 12 }]}>
            <Text variant="small" color="muted" style={{ textAlign: 'center' }}>
              You blocked {peer!.name}. They can't message or call you, and you can't reach them here.
            </Text>
            <Button
              title={`Unblock ${peer!.name.split(' ')[0]}`}
              kind="secondary"
              size="md"
              loading={setBlocked.isPending}
              onPress={() => block(false)}
            />
          </View>
        ) : (
          <View>
            {!isRoom && msgs.data && !items.some((m) => m.senderId === me && m.kind === 'text') ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: gutter - 6, paddingBottom: 10, gap: 8 }}
              >
                {STARTERS[(conv?.listing ? conv.listing.ownerId === me : myRole !== 'buyer') ? 'owner' : 'asker'].map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => send(t)}
                    style={s.starter}
                    accessibilityRole="button"
                    accessibilityLabel={t}
                    accessibilityHint="Sends this message"
                  >
                    <Text variant="smallMedium">{t}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            <View style={[s.composer, { paddingBottom: insets.bottom + 10 }]}>
              <TextInput
                value={text}
                onChangeText={onType}
                placeholder="Message"
                placeholderTextColor={c.muted}
                style={s.input}
                multiline
                maxLength={4000}
                accessibilityLabel="Message"
              />
              <Pressable
                onPress={() => send()}
                disabled={!text.trim()}
                style={[s.send, !text.trim() && { opacity: 0.35 }]}
                accessibilityRole="button"
                accessibilityLabel="Send"
              >
                <ArrowUp size={22} color={c.onInk} strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      {conv && isRoom ? (
        <BottomSheetModal
          ref={membersSheet}
          backdropComponent={(p) => <BottomSheetBackdrop {...p} disappearsOnIndex={-1} appearsOnIndex={0} />}
          backgroundStyle={{ backgroundColor: c.surface }}
          handleIndicatorStyle={{ backgroundColor: c.line }}
          enableDynamicSizing
          maxDynamicContentSize={640}
          onDismiss={() => setConfirmLeave(false)}
        >
          <BottomSheetView style={{ paddingHorizontal: gutter, paddingTop: 4, paddingBottom: insets.bottom + 16, gap: 4 }}>
            <View style={[s.sheetHead, { flexDirection: 'column', alignItems: 'flex-start', gap: 4 }]}>
              <Text variant="title">{conv.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Lock size={12} color={c.muted} />
                <Text variant="small" color="muted">
                  {conv.members.length} members · everyone's number stays hidden
                </Text>
              </View>
            </View>
            {conv.listing ? (
              <SheetRow
                icon={LandPlot}
                label="About this plot"
                hint={conv.listing.title}
                onPress={() => {
                  membersSheet.current?.dismiss();
                  router.push({ pathname: '/listing/[id]', params: { id: conv.listing!.id } });
                }}
              />
            ) : null}
            <SheetRow
              icon={Video}
              label="Join the meeting"
              onPress={() => {
                membersSheet.current?.dismiss();
                router.push({ pathname: '/room/[id]', params: { id } });
              }}
            />
            <Text variant="label" color="muted" style={{ marginTop: 10, marginBottom: 4 }}>
              Members
            </Text>
            {[...conv.members]
              .sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : a.name.localeCompare(b.name)))
              .map((u) => (
                <View key={u.id} style={s.memberRow} accessibilityLabel={`${u.id === me ? 'You' : u.name}, ${u.role}`}>
                  <View>
                    <Avatar name={u.name} uri={u.avatarUrl} size={44} />
                    {u.id !== me && presence[u.id] ? <View style={s.onlineDot} /> : null}
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text variant="bodyMedium" numberOfLines={1}>
                      {u.id === me ? `${u.name} (you)` : u.name}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <RoleBadge role={u.role} verified={u.verified} />
                      {u.id !== me && presence[u.id] ? (
                        <Text variant="small" color="brand">
                          online
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              ))}
            <View style={{ height: 1, backgroundColor: c.line, marginVertical: 8 }} />
            {confirmLeave ? (
              <View style={{ gap: 12, paddingTop: 4 }}>
                <Text variant="bodyMedium">Leave “{conv.title}”?</Text>
                <Text variant="small" color="muted">
                  You won't get its messages or meeting invites any more. The others will see that you left. Someone in the room has to add
                  you again to rejoin.
                </Text>
                <Button
                  title="Leave room"
                  kind="danger"
                  loading={leave.isPending}
                  onPress={() =>
                    leave.mutate(undefined, {
                      onSuccess: () => {
                        membersSheet.current?.dismiss();
                        toast(`You left ${conv.title}`);
                        router.back();
                      },
                      onError: (e) => toast.error(e.message),
                    })
                  }
                />
                <Button title="Cancel" kind="secondary" onPress={() => setConfirmLeave(false)} />
              </View>
            ) : (
              <SheetRow icon={LogOut} label="Leave room" danger onPress={() => setConfirmLeave(true)} />
            )}
          </BottomSheetView>
        </BottomSheetModal>
      ) : null}

      {peer && !isRoom ? (
        <BottomSheetModal
          ref={sheet}
          backdropComponent={(p) => <BottomSheetBackdrop {...p} disappearsOnIndex={-1} appearsOnIndex={0} />}
          backgroundStyle={{ backgroundColor: c.surface }}
          handleIndicatorStyle={{ backgroundColor: c.line }}
          onDismiss={() => setConfirmBlock(false)}
        >
          <BottomSheetView style={{ paddingHorizontal: gutter, paddingTop: 4, paddingBottom: insets.bottom + 16 }}>
            {confirmBlock ? (
              <View style={{ gap: 16 }}>
                <View style={[s.sheetIcon, { backgroundColor: c.dangerSoft }]}>
                  <ShieldBan size={24} color={c.danger} />
                </View>
                <View style={{ gap: 6 }}>
                  <Text variant="title">Block {peer.name}?</Text>
                  <Text variant="body" color="muted">
                    They won't be able to message or call you, and they aren't told. You can unblock them any time from your profile.
                  </Text>
                </View>
                <View style={{ gap: 10, marginTop: 4 }}>
                  <Button
                    title={`Block ${peer.name.split(' ')[0]}`}
                    kind="danger"
                    loading={setBlocked.isPending}
                    onPress={() => block(true)}
                  />
                  <Button title="Cancel" kind="secondary" onPress={() => sheet.current?.dismiss()} />
                </View>
              </View>
            ) : (
              <View>
                <View style={s.sheetHead}>
                  <Avatar name={peer.name} uri={peer.avatarUrl} size={48} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text variant="h2" numberOfLines={1}>
                      {peer.name}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <RoleBadge role={peer.role} verified={peer.verified} />
                      <Lock size={12} color={c.muted} />
                      <Text variant="small" color="muted">
                        Number hidden
                      </Text>
                    </View>
                  </View>
                </View>
                {conv?.listing ? (
                  <SheetRow
                    icon={LandPlot}
                    label="View listing"
                    hint={conv.listing.title}
                    onPress={() => {
                      sheet.current?.dismiss();
                      router.push({ pathname: '/listing/[id]', params: { id: conv.listing!.id } });
                    }}
                  />
                ) : null}
                {iBlocked ? null : (
                  <>
                    <SheetRow
                      icon={Phone}
                      label="Voice call"
                      onPress={() => {
                        sheet.current?.dismiss();
                        calls.start(id, 'audio', peer, conv?.listing?.title ?? null);
                      }}
                    />
                    <SheetRow
                      icon={Video}
                      label="Video call"
                      onPress={() => {
                        sheet.current?.dismiss();
                        calls.start(id, 'video', peer, conv?.listing?.title ?? null);
                      }}
                    />
                  </>
                )}
                {iBlocked ? (
                  <SheetRow
                    icon={ShieldCheck}
                    label={`Unblock ${peer.name.split(' ')[0]}`}
                    hint="They can message and call you again"
                    onPress={() => block(false)}
                  />
                ) : (
                  <SheetRow icon={ShieldBan} label={`Block ${peer.name.split(' ')[0]}`} danger onPress={() => setConfirmBlock(true)} />
                )}
              </View>
            )}
          </BottomSheetView>
        </BottomSheetModal>
      ) : null}
    </View>
  );
}

function SheetRow({
  icon: Icon,
  label,
  hint,
  danger,
  onPress,
}: {
  icon: typeof Phone;
  label: string;
  hint?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const s = useStyles();
  const { c } = useTheme();
  const color = danger ? c.danger : c.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.sheetRow, pressed && { backgroundColor: c.surfaceAlt }]}
    >
      <View style={[s.sheetIcon, { backgroundColor: danger ? c.dangerSoft : c.surfaceAlt }]}>
        <Icon size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium" style={{ color }}>
          {label}
        </Text>
        {hint ? (
          <Text variant="small" color="muted" numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
      {danger ? null : <ChevronRight size={18} color={c.muted} />}
    </Pressable>
  );
}

function Bubble({
  m,
  mine,
  grouped,
  onRetry,
  onCallBack,
}: {
  m: UiMessage;
  mine: boolean;
  grouped: boolean;
  onRetry: () => void;
  onCallBack?: (kind: 'audio' | 'video') => void;
}) {
  const s = useStyles();
  const { c } = useTheme();
  if (m.kind === 'system') {
    return (
      <View style={s.system}>
        <Text variant="small" color="inkSoft" style={{ textAlign: 'center' }}>
          {m.body}
        </Text>
      </View>
    );
  }
  if (m.kind === 'call') {
    const meta = (m.meta ?? {}) as { kind?: string; status?: string };
    const missed = meta.status !== 'ended';
    const Icon = missed ? PhoneMissed : meta.kind === 'video' ? Video : PhoneIncoming;
    return (
      <View style={[s.call, { alignSelf: mine ? 'flex-end' : 'flex-start' }]}>
        <View style={[s.callIcon, { backgroundColor: missed ? c.dangerSoft : c.brandSoft }]}>
          <Icon size={17} color={missed ? c.danger : c.brand} />
        </View>
        <View style={{ flexShrink: 1 }}>
          <Text variant="smallMedium">{m.body}</Text>
          <Text variant="micro" color="muted">
            {clockTime(m.createdAt)}
          </Text>
        </View>
        {onCallBack ? (
          <Pressable
            onPress={() => onCallBack(meta.kind === 'video' ? 'video' : 'audio')}
            style={s.callBack}
            accessibilityRole="button"
            accessibilityLabel={missed && !mine ? 'Call back' : 'Call again'}
            hitSlop={6}
          >
            <Text variant="micro">{missed && !mine ? 'Call back' : 'Call again'}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  const Tick = m.failed ? null : m.pending ? Clock3 : Check;
  return (
    <Pressable
      onPress={m.failed ? onRetry : undefined}
      disabled={!m.failed}
      style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', marginTop: grouped ? 2 : 10 }}
    >
      <View style={[s.bubble, mine ? s.out : s.in]}>
        <Text variant="body" style={{ color: mine ? c.bubbleOutText : c.ink }}>
          {m.body}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' }}>
          <Text variant="micro" style={{ color: mine ? c.bubbleOutText : c.muted, opacity: mine ? 0.6 : 1 }}>
            {clockTime(m.createdAt)}
          </Text>
          {mine && Tick ? <Tick size={13} color={c.bubbleOutText} style={{ opacity: 0.6 }} /> : null}
        </View>
      </View>
      {m.failed ? (
        <Text variant="micro" color="danger" style={{ alignSelf: 'flex-end', marginTop: 3 }}>
          Not sent. Tap to retry
        </Text>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeStyles(({ c }) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingBottom: 10,
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderColor: c.line,
  },
  roomIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' },
  pinned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: gutter,
    marginTop: 10,
    padding: 8,
    paddingRight: 14,
    borderRadius: radius.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  pinnedImg: { width: 56, height: 56, borderRadius: 12, backgroundColor: c.skeleton },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: c.ok,
    borderWidth: 2,
    borderColor: c.surface,
  },
  day: {
    alignSelf: 'center',
    backgroundColor: c.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginTop: 16,
    marginBottom: 4,
  },
  starter: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.full,
  },
  callBack: { marginLeft: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: c.ink },
  bubble: { paddingHorizontal: 14, paddingTop: 9, paddingBottom: 6, borderRadius: 18, gap: 2 },
  out: { backgroundColor: c.bubbleOut, borderBottomRightRadius: 6 },
  in: { backgroundColor: c.bubbleIn, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: c.line },
  system: {
    alignSelf: 'center',
    backgroundColor: c.accentSoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    marginVertical: 12,
    maxWidth: '90%',
  },
  call: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: radius.md,
    padding: 10,
    paddingRight: 16,
    marginTop: 10,
  },
  callIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: gutter - 6,
    paddingTop: 10,
    backgroundColor: c.bg,
    borderTopWidth: 1,
    borderColor: c.line,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 130,
    borderRadius: 23,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    ...type.body,
    color: c.ink,
  },
  blockedBar: { gap: 10, paddingHorizontal: gutter, paddingTop: 14, borderTopWidth: 1, borderColor: c.line, backgroundColor: c.bg },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 6 },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 14,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderColor: c.line,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 60,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: radius.md,
  },
  sheetIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
}));
