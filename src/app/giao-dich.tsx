import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';

import { Segmented } from '@/components/Segmented';
import { AsyncStatus, EmptyText } from '@/components/StateView';
import { TxnRow } from '@/components/TxnRow';
import { listTransactions, markReviewed, setSale, softDelete } from '@/data/repo';
import type { Txn } from '@/domain/types';
import { useAsync } from '@/hooks/useAsync';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useApp } from '@/state/AppContext';
import { ui } from '@/ui/theme';

const FILTERS = [
  { value: true, label: 'Chưa xem' },
  { value: false, label: 'Tất cả' },
];

// Màn "Giao dịch": lọc chưa xem / tất cả, tích tiền bán hàng, "Đã xem hết".
export default function TransactionsScreen() {
  const { db, version, mutate } = useApp();
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(true);
  const { refreshing, onRefresh } = usePullRefresh();
  const state = useAsync(() => listTransactions(db, onlyUnreviewed), [db, version, onlyUnreviewed]);

  const onToggleSale = useCallback(
    (t: Txn) => void mutate((d, owner) => setSale(d, t.id, t.is_sale !== 1, owner)),
    [mutate],
  );

  const onDelete = useCallback(
    (t: Txn) => {
      Alert.alert('Xoá khoản tiền mặt?', 'Khoản này sẽ không còn tính vào doanh thu. Lịch sử sửa vẫn được giữ.', [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Xoá', style: 'destructive', onPress: () => void mutate((d, owner) => softDelete(d, t.id, owner)) },
      ]);
    },
    [mutate],
  );

  const rows = state.data ?? [];
  const showReviewBar = onlyUnreviewed && rows.length > 0;

  // Chỉ đánh dấu đúng các khoản đang hiển thị; khoản mới về sau đó vẫn ở lại "Chưa xem".
  // Còn khoản tiền vào chưa tích "Bán hàng" thì hỏi lại, tránh lỡ tay tính tiền bán thành tiền cá nhân.
  const onMarkAll = () => {
    const ids = rows.filter((r) => r.reviewed === 0).map((r) => r.id);
    const personal = rows.filter((r) => r.reviewed === 0 && r.amount > 0 && r.is_sale !== 1).length;
    const run = () => void mutate((d, owner) => markReviewed(d, ids, owner));
    if (personal === 0) return run();
    Alert.alert(
      'Đã xem hết?',
      `Còn ${personal} khoản tiền vào CHƯA tích "Bán hàng". Các khoản này sẽ tính là tiền cá nhân, không cộng vào doanh thu.`,
      [
        { text: 'Xem lại', style: 'cancel' },
        { text: 'Đúng, là tiền cá nhân', onPress: run },
      ],
    );
  };

  return (
    <View style={ui.screen}>
      <Segmented options={FILTERS} value={onlyUnreviewed} onChange={setOnlyUnreviewed} variant="chip" />

      {showReviewBar && (
        <Text style={[ui.muted, { fontSize: 22, marginHorizontal: 16 }]}>
          Tích các khoản là tiền bán hàng, rồi bấm “Đã xem hết” để coi còn lại là tiền cá nhân.
        </Text>
      )}

      <AsyncStatus state={state} />

      <FlatList
        data={rows}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => <TxnRow db={db} txn={item} onToggleSale={onToggleSale} onDelete={onDelete} />}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          state.data ? (
            <EmptyText>{onlyUnreviewed ? 'Không còn khoản nào chưa xem 🎉' : 'Chưa có giao dịch nào'}</EmptyText>
          ) : undefined
        }
      />

      {showReviewBar && (
        <Pressable style={[ui.button, ui.bottomBar]} onPress={onMarkAll} accessibilityRole="button">
          <Text style={ui.buttonText}>Đã xem hết ({rows.length})</Text>
        </Pressable>
      )}
    </View>
  );
}
