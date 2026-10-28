import { StyleSheet, Text, View } from 'react-native';

import { SOURCE_LABEL } from '@/components/TxnRow';
import type { SaleRow } from '@/data/repo';
import { shiftOf, type SalesSummary, type Shift } from '@/domain/aggregate';
import { formatTime, formatVnd } from '@/domain/text';
import { colors } from '@/ui/theme';

export const SHIFTS: { key: Shift; label: string }[] = [
  { key: 'morning', label: 'Sáng' },
  { key: 'afternoon', label: 'Chiều' },
  { key: 'evening', label: 'Tối' },
];

// Danh sách các khoản đã cộng vào 1 kỳ; byShift = chia nhóm Sáng / Chiều / Tối (dùng cho 1 ngày).
export function SaleItems({ summary, byShift }: { summary: SalesSummary<SaleRow>; byShift: boolean }) {
  const groups = byShift
    ? SHIFTS.map((s) => ({
        title: `${s.label} · ${formatVnd(summary.byShift[s.key])}`,
        items: summary.items.filter((i) => shiftOf(i.occurred_at) === s.key),
      })).filter((g) => g.items.length > 0)
    : [{ title: null, items: summary.items }];

  return (
    <View style={styles.items}>
      {groups.map((g) => (
        <View key={g.title ?? 'all'}>
          {g.title && <Text style={styles.groupTitle}>{g.title}</Text>}
          {g.items.map((i) => (
            <View key={i.id} style={styles.item}>
              <View style={styles.rowBetween}>
                <Text style={styles.detail}>
                  {formatTime(i.occurred_at)} · {SOURCE_LABEL[i.source]}
                </Text>
                <Text style={styles.itemAmount}>{formatVnd(i.amount)}</Text>
              </View>
              {!!i.description && (
                <Text style={styles.detail} numberOfLines={1}>
                  {i.description}
                </Text>
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detail: { fontSize: 22, color: colors.muted },
  items: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  groupTitle: { marginTop: 10, fontSize: 24, fontWeight: '700', color: colors.text },
  item: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.bg },
  itemAmount: { fontSize: 24, fontWeight: '700', color: colors.text },
});
