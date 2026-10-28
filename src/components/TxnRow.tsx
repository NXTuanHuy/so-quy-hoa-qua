import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { SQLiteDatabase } from 'expo-sqlite';

import { getHistory } from '@/data/repo';
import { formatTime, formatVnd } from '@/domain/text';
import type { EditHistory, Txn } from '@/domain/types';
import { runSafely } from '@/ui/runSafely';
import { colors, ui } from '@/ui/theme';

type Props = {
  // Truyền db qua prop (ổn định) thay vì useApp(), để dòng không vẽ lại mỗi khi trạng thái đồng bộ đổi.
  db: SQLiteDatabase;
  txn: Txn;
  onToggleSale: (txn: Txn) => void;
  onDelete: (txn: Txn) => void;
};

export const SOURCE_LABEL: Record<Txn['source'], string> = { MB: 'MB', BIDV: 'BIDV', CASH: 'Tiền mặt' };
const FIELD_LABEL: Record<string, string> = { is_sale: 'Bán hàng', deleted: 'Xoá' };
const yesNo = (v: string | null) => (v === '1' ? 'có' : 'không');

// 1 dòng biến động: số tiền, nguồn, nội dung, ô tích "Bán hàng". Chạm để xem lịch sử sửa.
export const TxnRow = memo(function TxnRow({ db, txn, onToggleSale, onDelete }: Props) {
  const [history, setHistory] = useState<EditHistory[] | null>(null);
  const incoming = txn.amount > 0;
  const suggested = txn.is_sale === 1 && txn.reviewed === 0;

  const toggleHistory = () =>
    runSafely(async () => {
      setHistory(history ? null : await getHistory(db, txn.id));
    }, 'Không tải được lịch sử sửa');

  return (
    <View style={[styles.row, txn.reviewed === 0 && styles.unreviewed]}>
      <Pressable style={{ flex: 1 }} onPress={toggleHistory} accessibilityHint="Xem lịch sử sửa">
        <Text style={[styles.amount, { color: incoming ? colors.primary : colors.danger }]}>
          {incoming ? '+' : ''}
          {formatVnd(txn.amount)}
        </Text>
        <Text style={styles.meta}>
          {formatTime(txn.occurred_at)} · {SOURCE_LABEL[txn.source]}
          {txn.account ? ` ${txn.account}` : ''}
        </Text>
        {!!txn.description && (
          <Text style={styles.desc} numberOfLines={history ? undefined : 2}>
            {txn.description}
          </Text>
        )}
        {history && (
          <View style={styles.history}>
            {history.length === 0 && <Text style={ui.muted}>Chưa có lần sửa nào</Text>}
            {history.map((h) => (
              <Text key={h.id} style={ui.muted}>
                {formatTime(h.changed_at)} · {h.changed_by}: {FIELD_LABEL[h.field] ?? h.field} {yesNo(h.old_value)} →{' '}
                {yesNo(h.new_value)}
              </Text>
            ))}
            {txn.source === 'CASH' && (
              <Pressable onPress={() => onDelete(txn)} style={{ marginTop: 8 }} accessibilityRole="button">
                <Text style={{ color: colors.danger, fontWeight: '600' }}>Xoá khoản tiền mặt này</Text>
              </Pressable>
            )}
          </View>
        )}
      </Pressable>

      {incoming && (
        <Pressable
          onPress={() => onToggleSale(txn)}
          style={styles.check}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: txn.is_sale === 1 }}
          accessibilityLabel="Tiền bán hàng"
          hitSlop={8}
        >
          <View style={[styles.box, txn.is_sale === 1 && styles.boxOn]}>
            {txn.is_sale === 1 && <Text style={styles.tick}>✓</Text>}
          </View>
          <Text style={[ui.muted, { fontSize: 18 }]}>{suggested ? 'Gợi ý' : 'Bán hàng'}</Text>
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unreviewed: { borderColor: colors.warn, backgroundColor: colors.warnSoft },
  amount: { fontSize: 34, fontWeight: '700' },
  meta: { fontSize: 22, color: colors.muted },
  desc: { fontSize: 24, color: colors.text },
  history: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border, gap: 2 },
  check: { alignItems: 'center', justifyContent: 'center', width: 80 },
  box: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  boxOn: { backgroundColor: colors.primary },
  tick: { color: '#fff', fontSize: 28, fontWeight: '700' },
});
