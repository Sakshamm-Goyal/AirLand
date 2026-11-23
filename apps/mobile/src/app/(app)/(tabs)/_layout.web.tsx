import { TabList, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { CircleUser, type LucideIcon, Map as MapIcon, MessagesSquare, Phone, Search } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui';
import { useConversations } from '@/lib/queries';
import { makeStyles, useTheme } from '@/theme';

export const unstable_settings = { anchor: 'explore' };

/**
 * Web only: expo-router's web NativeTabs is a floating pill at the top of the page, which covers screen headers.
 * This renders the same five tabs as a Material-style bottom bar, matching the Android app. Native uses _layout.tsx.
 */
export default function TabsLayout() {
  const { c } = useTheme();
  const st = useStyles();
  const insets = useSafeAreaInsets();
  const unread = useConversations().data?.reduce((n, conv) => n + conv.unread, 0) ?? 0;
  return (
    <Tabs style={{ flex: 1, backgroundColor: c.bg }}>
      <TabSlot style={{ flexShrink: 1, minHeight: 0 }} />
      <TabList style={[st.bar, { paddingBottom: 8 + insets.bottom }]}>
        <TabTrigger name="explore" href="/explore" asChild>
          <Tab icon={Search} label="Explore" />
        </TabTrigger>
        <TabTrigger name="map" href="/map" asChild>
          <Tab icon={MapIcon} label="Map" />
        </TabTrigger>
        <TabTrigger name="chats" href="/chats" asChild>
          <Tab icon={MessagesSquare} label="Chats" badge={unread} />
        </TabTrigger>
        <TabTrigger name="calls" href="/calls" asChild>
          <Tab icon={Phone} label="Calls" />
        </TabTrigger>
        <TabTrigger name="profile" href="/profile" asChild>
          <Tab icon={CircleUser} label="You" />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

function Tab({
  icon: Icon,
  label,
  badge = 0,
  isFocused,
  ref: _ref,
  ...props
}: TabTriggerSlotProps & { icon: LucideIcon; label: string; badge?: number }) {
  const { c } = useTheme();
  const st = useStyles();
  return (
    <Pressable
      {...props}
      role="tab"
      aria-selected={isFocused}
      accessibilityLabel={badge ? `${label}, ${badge} unread` : label}
      style={st.tab}
    >
      <View style={st.pill}>
        <Icon size={24} color={isFocused ? c.accent : c.muted} strokeWidth={isFocused ? 2.2 : 1.8} />
        {badge > 0 ? (
          <View style={st.badge}>
            <Text variant="micro" color="onPhoto" style={st.badgeText}>
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant={isFocused ? 'micro' : 'smallMedium'} color={isFocused ? 'accent' : 'muted'} style={st.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles(({ c }) => ({
  bar: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.line,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, minHeight: 52 },
  pill: { width: 48, height: 28, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -2,
    right: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, lineHeight: 14 },
  label: { fontSize: 12, lineHeight: 16 },
}));
