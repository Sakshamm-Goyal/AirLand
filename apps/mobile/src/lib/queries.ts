import type {
  AuthResponse,
  CallLogEntry,
  Conversation,
  LandType,
  Listing,
  ListingInput,
  LoginInput,
  Me,
  Message,
  Page,
  PublicUser,
  SignUpInput,
} from '@landconnect/shared';
import { type InfiniteData, QueryClient, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useSession } from './session';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: (n, e) => n < 2 && !(e as { status?: number }).status?.toString().startsWith('4') },
  },
});

export interface Filters {
  q?: string;
  type?: LandType;
  minPrice?: number;
  maxPrice?: number;
  saved?: 'true';
}

/** Every query key in one place, so invalidation is greppable. */
export const qk = {
  listings: (f: Filters) => ['listings', f] as const,
  mapListings: (bbox: string) => ['listings', 'map', bbox] as const,
  myListings: ['listings', 'mine'] as const,
  listing: (id: string) => ['listing', id] as const,
  conversations: ['conversations'] as const,
  conversation: (id: string) => ['conversation', id] as const,
  messages: (id: string) => ['messages', id] as const,
  calls: ['calls'] as const,
  blocks: ['blocks'] as const,
};

const qs = (o: object) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== '') as [string, string][]).toString();

// ── Auth ─────────────────────────────────────────────────────────────────
export function useSignIn() {
  return useMutation({
    mutationFn: (b: LoginInput) => api.public<AuthResponse>('/auth/login', b),
    onSuccess: (r) => useSession.getState().set(r),
  });
}
export function useSignUp() {
  return useMutation({
    mutationFn: (b: SignUpInput) => api.public<AuthResponse>('/auth/signup', b),
    onSuccess: (r) => useSession.getState().set(r),
  });
}
export function useUpdateMe() {
  return useMutation({
    mutationFn: (b: Partial<Pick<Me, 'callPolicy' | 'showApproxLocation' | 'name'>> & { pushToken?: string | null }) =>
      api.patch<Me>('/me', b),
    onSuccess: (u) => useSession.getState().setUser(u),
  });
}

// ── Listings ─────────────────────────────────────────────────────────────
export function useListings(f: Filters) {
  return useInfiniteQuery({
    queryKey: qk.listings(f),
    queryFn: ({ pageParam, signal }) => api.get<Page<Listing>>(`/listings?${qs({ ...f, cursor: pageParam, limit: 12 })}`, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
}

export function useMapListings(bbox: string | null) {
  return useQuery({
    queryKey: qk.mapListings(bbox ?? ''),
    queryFn: ({ signal }) => api.get<Page<Listing>>(`/listings?bbox=${bbox}`, signal),
    enabled: !!bbox,
    placeholderData: (prev) => prev, // keep markers while panning
  });
}

export function useMyListings() {
  return useQuery({ queryKey: qk.myListings, queryFn: () => api.get<Page<Listing>>('/listings?owner=me&limit=50') });
}

export function useListing(id: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: qk.listing(id),
    queryFn: ({ signal }) => api.get<Listing>(`/listings/${id}`, signal),
    // Instant detail screen: seed from any feed page that already has this listing.
    initialData: () => {
      for (const [, data] of qc.getQueriesData<InfiniteData<Page<Listing>>>({ queryKey: ['listings'] })) {
        const hit = data?.pages?.flatMap((p) => p.items).find((l) => l.id === id);
        if (hit) return hit;
      }
      return undefined;
    },
    initialDataUpdatedAt: 0,
  });
}

export function useCreateListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: ListingInput) => api.post<Listing>('/listings', b),
    onSuccess: (l) => {
      qc.setQueryData(qk.listing(l.id), l);
      void qc.invalidateQueries({ queryKey: ['listings'] });
    },
  });
}

export function useUpdateListing(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Partial<ListingInput> & { status?: 'active' | 'sold' }) => api.patch<Listing>(`/listings/${id}`, b),
    onSuccess: (l) => {
      qc.setQueryData(qk.listing(id), l);
      void qc.invalidateQueries({ queryKey: ['listings'] });
    },
  });
}

export function useDeleteListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/listings/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listings'] }),
  });
}

/** Optimistic save/unsave. */
export function useToggleSave(listing: Listing) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (save: boolean) => (save ? api.put(`/listings/${listing.id}/save`) : api.del(`/listings/${listing.id}/save`)),
    onMutate: (save) => qc.setQueryData<Listing>(qk.listing(listing.id), (l) => (l ? { ...l, saved: save } : l)),
    onError: () => qc.setQueryData<Listing>(qk.listing(listing.id), (l) => (l ? { ...l, saved: listing.saved } : l)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['listings'] }),
  });
}

// ── Conversations & messages ─────────────────────────────────────────────
export function useConversations() {
  return useQuery({ queryKey: qk.conversations, queryFn: () => api.get<Conversation[]>('/conversations') });
}

export function useConversation(id: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: qk.conversation(id),
    queryFn: () => api.get<Conversation>(`/conversations/${id}`),
    initialData: () => qc.getQueryData<Conversation[]>(qk.conversations)?.find((c) => c.id === id),
    initialDataUpdatedAt: 0,
  });
}

export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listingId: string) => api.post<Conversation>('/conversations', { listingId }),
    onSuccess: (c) => {
      qc.setQueryData(qk.conversation(c.id), c);
      void qc.invalidateQueries({ queryKey: qk.conversations });
    },
  });
}

export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: qk.messages(conversationId),
    queryFn: ({ pageParam }) => api.get<Message[]>(`/conversations/${conversationId}/messages?${qs({ before: pageParam, limit: 40 })}`),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => (p.length === 40 ? p.at(-1)?.createdAt : undefined),
  });
}

/** Insert or reconcile a message in the cached (newest-first) pages. */
export function upsertMessage(m: Message) {
  queryClient.setQueryData<InfiniteData<Message[]>>(qk.messages(m.conversationId), (data) => {
    if (!data) return data;
    const [first = [], ...rest] = data.pages;
    const idx = first.findIndex((x) => x.id === m.id || (m.clientId && x.clientId === m.clientId));
    const page = idx >= 0 ? first.map((x, i) => (i === idx ? { ...m, clientId: x.clientId } : x)) : [m, ...first];
    return { ...data, pages: [page, ...rest] };
  });
}

export function useCallLog() {
  return useQuery({ queryKey: qk.calls, queryFn: () => api.get<CallLogEntry[]>('/calls') });
}

// ── Blocking ─────────────────────────────────────────────────────────────
export function useBlocks() {
  return useQuery({ queryKey: qk.blocks, queryFn: () => api.get<PublicUser[]>('/me/blocks') });
}

export function useSetBlocked() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, blocked }: { userId: string; blocked: boolean }) =>
      blocked ? api.post(`/users/${userId}/block`) : api.del(`/users/${userId}/block`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.blocks }),
  });
}
