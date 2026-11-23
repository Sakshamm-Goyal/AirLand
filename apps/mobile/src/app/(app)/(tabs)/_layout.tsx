import { NativeTabs } from 'expo-router/native-tabs';
import { useConversations } from '@/lib/queries';
import { font, useTheme } from '@/theme';

export const unstable_settings = { anchor: 'explore' };

/** Real native tab bar: Material 3 on Android, system tab bar on iOS. */
export default function TabsLayout() {
  const { c } = useTheme();
  const unread = useConversations().data?.reduce((n, conv) => n + conv.unread, 0) ?? 0;
  return (
    <NativeTabs
      backgroundColor={c.surface}
      tintColor={c.accent}
      iconColor={{ default: c.muted, selected: c.accent }}
      indicatorColor="transparent"
      badgeBackgroundColor={c.accent}
      labelStyle={{
        default: { color: c.muted, fontFamily: font.medium, fontSize: 11.5 },
        selected: { color: c.accent, fontFamily: font.semibold, fontSize: 11.5 },
      }}
    >
      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="map">
        <NativeTabs.Trigger.Label>Map</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} md="map" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chats">
        <NativeTabs.Trigger.Label>Chats</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }}
          md="forum"
        />
        {unread > 0 ? <NativeTabs.Trigger.Badge>{unread > 99 ? '99+' : String(unread)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calls">
        <NativeTabs.Trigger.Label>Calls</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'phone', selected: 'phone.fill' }} md="call" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>You</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
