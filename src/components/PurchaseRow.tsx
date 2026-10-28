import { memo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDueDate } from '@/domain/notes';
import { formatVnd } from '@/domain/text';
import type { PaidBy, Purchase } from '@/domain/types';
import { colors, ui } from '@/ui/theme';

type Props = {
  purchase: Purchase;
  // Hiện ngày nhập (dùng ở danh sách nợ gồm nhiều ngày).
  showDate?: boolean;
  onEdit?: (p: Purchase) => void;
  onDelete?: (p: Purchase) => void;
  onPaid: (p: Purchase, paid: PaidBy) => void;
};

const PAID_LABEL: Record<PaidBy, string> = { CASH: 'Đã trả tiền mặt', TRANSFER: 'Đã chuyển khoản', DEBT: 'CÒN NỢ' };

// 1 khoản chi (tiền hàng / thuê nhà): nội dung + số lượng, thành tiền, trả cho ai, đã trả / còn nợ, nút Đã trả / Sửa / Xoá.
export const PurchaseRow = memo(function PurchaseRow({ purchase: p, showDate, onEdit, onDelete, onPaid }: Props) {
  const debt = p.paid === 'DEBT';
  const rent = p.category === 'RENT';

  const payDebt = () =>
    Alert.alert('Đã trả khoản này?', `${p.item} · ${formatVnd(p.amount)}${p.supplier ? ` cho ${p.supplier}` : ''}`, [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Tiền mặt', onPress: () => onPaid(p, 'CASH') },
      { text: 'Chuyển khoản', onPress: () => onPaid(p, 'TRANSFER') },
    ]);

  return (
    <View style={[ui.card, debt && ui.cardDanger]}>
      <Text style={styles.meta}>
        {rent ? '🏠 Thuê nhà' : '📦 Tiền hàng'}
        {showDate ? ` · ${formatDueDate(p.date, Date.now())}` : ''}
      </Text>
      <Text style={styles.item}>
        {p.item}
        {p.quantity ? ` · ${p.quantity}` : ''}
      </Text>
      <Text style={styles.amount}>{formatVnd(p.amount)}</Text>
      {!!p.supplier && (
        <Text style={styles.line}>
          {rent ? 'Trả cho' : 'Nhập của'}: {p.supplier}
        </Text>
      )}
      {!!p.note && <Text style={styles.line}>Ghi chú: {p.note}</Text>}
      <Text style={[styles.paid, debt && { color: colors.danger }]}>{PAID_LABEL[p.paid]}</Text>

      <View style={styles.actions}>
        {debt && (
          <Pressable style={[ui.button, { flex: 2 }]} onPress={payDebt} accessibilityRole="button">
            <Text style={ui.buttonText}>Đã trả</Text>
          </Pressable>
        )}
        {onEdit && (
          <Pressable style={[ui.buttonGhost, { flex: 1 }]} onPress={() => onEdit(p)} accessibilityRole="button">
            <Text style={ui.buttonGhostText}>Sửa</Text>
          </Pressable>
        )}
        {onDelete && (
          <Pressable
            style={[ui.buttonGhost, { flex: 1, borderColor: colors.danger }]}
            onPress={() => onDelete(p)}
            accessibilityRole="button"
          >
            <Text style={[ui.buttonGhostText, { color: colors.danger }]}>Xoá</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  meta: { fontSize: 20, fontWeight: '600', color: colors.muted },
  item: { fontSize: 26, fontWeight: '700', color: colors.text },
  amount: { fontSize: 30, fontWeight: '700', color: colors.text, marginTop: 2 },
  line: { fontSize: 22, color: colors.text, marginTop: 4 },
  paid: { fontSize: 22, fontWeight: '700', color: colors.primary, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
});
