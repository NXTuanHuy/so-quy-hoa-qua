import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { PurchaseRow } from '@/components/PurchaseRow';
import { SaleItems, SHIFTS } from '@/components/SaleItems';
import { Segmented } from '@/components/Segmented';
import { AsyncStatus, EmptyText } from '@/components/StateView';
import { listDebtPurchases, listPurchasesBetween, setPurchasePaid } from '@/data/purchases';
import { listSalesSince } from '@/data/repo';
import { labelOf, reportRangeStart, summarizeSales } from '@/domain/aggregate';
import { toDateKey } from '@/domain/notes';
import { debtsBySupplier, expenseTotals, mergeReport } from '@/domain/purchases';
import { formatVnd } from '@/domain/text';
import type { PaidBy, Period, Purchase } from '@/domain/types';
import { useAsync } from '@/hooks/useAsync';
import { useApp } from '@/state/AppContext';
import { colors, ui } from '@/ui/theme';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'day', label: 'Ngày' },
  { value: 'week', label: 'Tuần' },
  { value: 'month', label: 'Tháng' },
  { value: 'year', label: 'Năm' },
];

// Màn "Báo cáo": thu bán hàng theo ngày / tuần / tháng / năm, kèm tiền đã chi (tiền hàng, thuê nhà — chỉ tham khảo); khoản còn nợ.
export default function ReportScreen() {
  const { db, version, mutate } = useApp();
  const [period, setPeriod] = useState<Period>('day');
  // Kỳ đang mở danh sách (theo `start`), null = không mở kỳ nào.
  const [openKey, setOpenKey] = useState<number | null>(null);
  const [debtOpen, setDebtOpen] = useState(false);
  // Chỉ tải dữ liệu trong khoảng thời gian của kiểu kỳ đang chọn.
  // Trả kèm `period` để không gộp dữ liệu của kỳ cũ theo kỳ mới trong lúc đang tải.
  const state = useAsync(async () => {
    const since = reportRangeStart(Date.now(), period);
    const [sales, purchases, debts] = await Promise.all([
      listSalesSince(db, since),
      listPurchasesBetween(db, toDateKey(new Date(since)), '9999-12-31'),
      listDebtPurchases(db),
    ]);
    return { period, sales, purchases, debts };
  }, [db, version, period]);

  const rows = useMemo(
    () =>
      state.data
        ? mergeReport(summarizeSales(state.data.sales, state.data.period), expenseTotals(state.data.purchases, state.data.period))
        : [],
    [state.data],
  );
  const debts = useMemo(() => debtsBySupplier(state.data?.debts ?? []), [state.data]);
  const debtTotal = debts.reduce((sum, d) => sum + d.total, 0);
  const max = useMemo(() => Math.max(1, ...rows.map((r) => r.sales?.total ?? 0)), [rows]);
  const shownPeriod = state.data?.period ?? period;
  const isDay = shownPeriod === 'day';

  const onPaid = useCallback(
    (p: Purchase, paid: PaidBy) => void mutate((d, owner) => setPurchasePaid(d, p.id, paid, owner)),
    [mutate],
  );

  return (
    <View style={ui.screen}>
      <Segmented options={PERIODS} value={period} onChange={setPeriod} />

      <AsyncStatus state={state} />

      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.start)}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={
          debts.length > 0 ? (
            <>
            <Pressable
              style={[ui.card, ui.cardDanger]}
              onPress={() => setDebtOpen((o) => !o)}
              accessibilityRole="button"
              accessibilityState={{ expanded: debtOpen }}
            >
              <Text style={[styles.label, { color: colors.danger }]}>Còn nợ chưa trả</Text>
              <Text style={[styles.total, { color: colors.danger }]}>{formatVnd(debtTotal)}</Text>
              {debts.map((d) => (
                <Text key={d.supplier} style={styles.detail}>
                  {d.supplier}: {formatVnd(d.total)} ({d.items.length} lần)
                </Text>
              ))}
              <Text style={[styles.toggle, { color: colors.danger }]}>{debtOpen ? '▲ Thu gọn' : '▼ Xem / đánh dấu đã trả'}</Text>
            </Pressable>
            {debtOpen &&
              debts.flatMap((d) => d.items).map((p) => <PurchaseRow key={p.id} purchase={p} showDate onPaid={onPaid} />)}
            </>
          ) : undefined
        }
        ListEmptyComponent={state.data ? <EmptyText>Chưa có số liệu</EmptyText> : undefined}
        renderItem={({ item }) => {
          const s = item.sales;
          const open = openKey === item.start;
          return (
              <Pressable
                style={[ui.card, { marginTop: 8 }]}
                onPress={() => s && setOpenKey(open ? null : item.start)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
              >
                <Text style={styles.label}>{labelOf(new Date(item.start), shownPeriod)}</Text>
                <Text style={styles.total}>{formatVnd(s?.total ?? 0)}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.bar, { width: `${((s?.total ?? 0) / max) * 100}%` }]} />
                </View>
                {s && (
                  <Text style={styles.detail}>
                    Chuyển khoản {formatVnd(s.transfer)} · Tiền mặt {formatVnd(s.cash)} · {s.count} khoản
                  </Text>
                )}
                {s && isDay && (
                  <Text style={styles.detail}>{SHIFTS.map((x) => `${x.label} ${formatVnd(s.byShift[x.key])}`).join(' · ')}</Text>
                )}
                {(item.expense.GOODS > 0 || item.expense.RENT > 0) && (
                  <View style={styles.expense}>
                    <Text style={styles.expenseTitle}>Đã chi (chỉ để tham khảo)</Text>
                    {item.expense.GOODS > 0 && <Text style={styles.line}>📦 Tiền hàng: {formatVnd(item.expense.GOODS)}</Text>}
                    {item.expense.RENT > 0 && <Text style={styles.line}>🏠 Thuê nhà: {formatVnd(item.expense.RENT)}</Text>}
                  </View>
                )}
                {s && <Text style={styles.toggle}>{open ? '▲ Thu gọn' : `▼ Xem ${s.count} khoản đã cộng`}</Text>}
                {open && s && <SaleItems summary={s} byShift={isDay} />}
              </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.bg, marginVertical: 10, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  label: { fontSize: 26, fontWeight: '600', color: colors.text },
  total: { fontSize: 36, fontWeight: '700', color: colors.primary, marginTop: 4 },
  detail: { fontSize: 22, color: colors.muted },
  line: { fontSize: 22, color: colors.text, marginTop: 4 },
  expense: { marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: colors.bg },
  expenseTitle: { fontSize: 18, fontWeight: '700', color: colors.muted },
  toggle: { marginTop: 10, fontSize: 22, color: colors.primary, fontWeight: '600' },
});
