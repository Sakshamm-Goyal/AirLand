import type { Conversation, PublicUser } from '@landconnect/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { toast } from 'sonner-native';
import { FormScreen } from '@/components/FormScreen';
import { Avatar, Button, Field, RoleBadge, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { peerOf } from '@/lib/conversation';
import { qk, useConversations } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { radius, useTheme } from '@/theme';

/** Sellers/brokers group people they're already talking to into a deal room. */
export default function NewRoom() {
  const { c } = useTheme();
  const me = useSession((s) => s.user!.id);
  const qc = useQueryClient();
  const convs = useConversations().data ?? [];
  const contacts = [
    ...new Map(convs.filter((x) => x.kind === 'direct').map((x) => [peerOf(x, me).id, peerOf(x, me)] as [string, PublicUser])).values(),
  ];
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const create = useMutation({
    mutationFn: () => api.post<Conversation>('/conversations/rooms', { title: title.trim(), memberIds: picked }),
    onSuccess: (conv) => {
      void qc.invalidateQueries({ queryKey: qk.conversations });
      router.replace({ pathname: '/chat/[id]', params: { id: conv.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <FormScreen
      title="New deal room"
      subtitle="A group chat and video meeting for a site visit or negotiation."
      footer={
        <Button
          title="Create room"
          onPress={() => create.mutate()}
          loading={create.isPending}
          disabled={title.trim().length < 3 || !picked.length}
        />
      }
    >
      <Field label="Room name" placeholder="e.g. Devanahalli site visit, Saturday" value={title} onChangeText={setTitle} maxLength={60} />
      <Text variant="h1">Add people</Text>
      {contacts.length ? (
        contacts.map((u) => {
          const on = picked.includes(u.id);
          return (
            <Pressable
              key={u.id}
              onPress={() => setPicked((p) => (on ? p.filter((x) => x !== u.id) : [...p, u.id]))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                borderRadius: radius.md,
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: on ? c.ink : c.line,
              }}
            >
              <Avatar name={u.name} uri={u.avatarUrl} size={40} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text variant="bodyMedium">{u.name}</Text>
                <RoleBadge role={u.role} verified={u.verified} />
              </View>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: on ? c.ink : c.line,
                  backgroundColor: on ? c.ink : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {on ? <Check size={14} color={c.onInk} strokeWidth={3} /> : null}
              </View>
            </Pressable>
          );
        })
      ) : (
        <Text variant="body" color="muted">
          People appear here once they've enquired on one of your listings.
        </Text>
      )}
    </FormScreen>
  );
}
