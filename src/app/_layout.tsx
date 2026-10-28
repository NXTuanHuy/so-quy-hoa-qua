import { Tabs } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { Text } from 'react-native';

import { Loading } from '@/components/StateView';
import { DB_NAME, migrate } from '@/data/db';
import { AppProvider } from '@/state/AppContext';
import { colors } from '@/ui/theme';

// Icon tab bằng emoji (không cần thư viện icon); tab đang chọn hiện rõ, tab khác mờ đi.
function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 24, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>;
}
const tabIcon = (emoji: string) =>
  function Icon({ focused }: { focused: boolean }) {
    return <TabIcon emoji={emoji} focused={focused} />;
  };

// Khung app: mở SQLite (chạy migrate), trạng thái chung, 5 tab.
export default function RootLayout() {
  return (
    <Suspense fallback={<Loading />}>
      <SQLiteProvider databaseName={DB_NAME} onInit={migrate} useSuspense>
        <AppProvider>
          <StatusBar style="dark" />
          <Tabs
            screenOptions={{
              headerTitleAlign: 'center',
              tabBarActiveTintColor: colors.primary,
              headerTitleStyle: { fontSize: 24, fontWeight: '700' },
              // 5 tab: 16 là cỡ lớn nhất mà "Giao dịch" vẫn vừa 1 dòng trên máy màn hình 360dp.
              tabBarLabelStyle: { fontSize: 16, fontWeight: '600' },
            }}
          >
            <Tabs.Screen name="index" options={{ title: 'Hôm nay', tabBarIcon: tabIcon('🏠') }} />
            <Tabs.Screen name="lich" options={{ title: 'Lịch', tabBarIcon: tabIcon('📅') }} />
            <Tabs.Screen name="giao-dich" options={{ title: 'Giao dịch', tabBarIcon: tabIcon('💳') }} />
            <Tabs.Screen name="bao-cao" options={{ title: 'Báo cáo', tabBarIcon: tabIcon('📊') }} />
            <Tabs.Screen name="cai-dat" options={{ title: 'Cài đặt', tabBarIcon: tabIcon('⚙️') }} />
          </Tabs>
        </AppProvider>
      </SQLiteProvider>
    </Suspense>
  );
}
