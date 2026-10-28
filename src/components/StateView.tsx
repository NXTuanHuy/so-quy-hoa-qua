import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import type { AsyncState } from '@/hooks/useAsync';
import { colors, ui } from '@/ui/theme';

// Vòng xoay chờ tải.
export function Loading() {
  return (
    <View style={{ padding: 32, alignItems: 'center' }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

// Hộp báo lỗi màu đỏ, hiển thị `message`.
export function ErrorBox({ message }: { message: string }) {
  return (
    <View style={[ui.card, ui.cardDanger]}>
      <Text style={[ui.text, { color: colors.danger }]}>Có lỗi: {message}</Text>
    </View>
  );
}

// Vòng xoay ở lần tải đầu + hộp lỗi nếu có, cho 1 kết quả useAsync.
export function AsyncStatus({ state }: { state: AsyncState<unknown> }) {
  return (
    <>
      {state.loading && <Loading />}
      {state.error && <ErrorBox message={state.error} />}
    </>
  );
}

// Dòng chữ xám căn giữa cho danh sách trống.
export function EmptyText({ children }: { children: ReactNode }) {
  return <Text style={ui.emptyText}>{children}</Text>;
}
