import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CashEntryModal } from '@/components/CashEntryModal';
import { NoteCard } from '@/components/NoteCard';
import { PurchaseFormModal } from '@/components/PurchaseFormModal';
import { AsyncStatus } from '@/components/StateView';
import { listRemindingNotes, setNoteDone } from '@/data/notes';
import { listDayOffs, listPeople } from '@/data/people';
import { listPurchasesBetween, savePurchase } from '@/data/purchases';
import { addCashSale, countUnreviewed, listBankRowsSince, listSalesSince, patchGap } from '@/data/repo';
import { periodStart, summarizeSales } from '@/domain/aggregate';
import { attendanceOn, offText, workingText } from '@/domain/calendar';
import { upcomingOccasions } from '@/domain/lunar';
import { toDateKey } from '@/domain/notes';
import { findBalanceGaps, type BalanceGap } from '@/domain/reconcile';
import { formatTime, formatVnd } from '@/domain/text';
import { useAsync } from '@/hooks/useAsync';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useApp } from '@/state/AppContext';
import { colors, ui } from '@/ui/theme';

// Chỉ đối soát số dư trong 30 ngày gần nhất để màn hình chính luôn nhẹ.
const GAP_WINDOW_MS = 30 * 24 * 60 * 60_000;

// Màn "Hôm nay", theo thứ tự quan trọng: doanh thu → khoản chưa xem / nghi sót → việc cần làm → dịp sắp tới + người làm.
export default function TodayScreen() {
  const { db, version, permissionGranted, sync, mutate } = useApp();
  const [cashOpen, setCashOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const { refreshing, onRefresh } = usePullRefresh();

  const state = useAsync(async () => {
    const now = Date.now();
    const todayKey = toDateKey(new Date(now));
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = toDateKey(tomorrow);
    const [sales, unreviewed, bankRows, reminders, people, offs, purchases] = await Promise.all([
      listSalesSince(db, periodStart(now, 'day').getTime()),
      countUnreviewed(db),
      listBankRowsSince(db, now - GAP_WINDOW_MS),
      listRemindingNotes(db, now),
      listPeople(db),
      listDayOffs(db, todayKey, tomorrowKey),
      listPurchasesBetween(db, todayKey, todayKey),
    ]);
    return {
      today: summarizeSales(sales, 'day')[0],
      purchaseToday: purchases.reduce((sum, p) => sum + p.amount, 0),
      unreviewed,
      gaps: findBalanceGaps(bankRows),
      reminders,
      hasPeople: people.length > 0,
      workingToday: workingText(attendanceOn(people, offs.filter((o) => o.date === todayKey))),
      offTomorrow: offText(attendanceOn(people, offs.filter((o) => o.date === tomorrowKey))),
      occasions: upcomingOccasions(new Date(now), 2),
    };
  }, [db, version]);

  const onPatch = (gap: BalanceGap) => {
    Alert.alert(
      'Vá khoản bị sót?',
      `Thêm 1 khoản nhập tay ${formatVnd(gap.missingAmount)} vào ${gap.source} ${gap.account}. Hãy kiểm tra lại trong app ngân hàng.`,
      [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Vá', onPress: () => void mutate((d, owner) => patchGap(d, gap, owner)) },
      ],
    );
  };

  const today = state.data?.today;

  return (
    <View style={ui.screen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {permissionGranted === false && (
          <Pressable style={[ui.card, ui.cardWarn]} onPress={() => router.push('/cai-dat')} accessibilityRole="button">
            <Text style={[ui.h2, { color: colors.warn }]}>Chưa cấp quyền đọc thông báo</Text>
            <Text style={ui.text}>Chạm để mở Cài đặt và bật quyền, nếu không app sẽ không ghi được chuyển khoản.</Text>
          </Pressable>
        )}

        <AsyncStatus state={state} />

        {state.data && (
          <>
            {/* 1. Quan trọng nhất: doanh thu hôm nay. */}
            <View style={ui.card}>
              <Text style={ui.muted}>Thu bán hàng hôm nay</Text>
              <Text style={[ui.h1, { color: colors.primary }]}>{formatVnd(today?.total ?? 0)}</Text>
              <Text style={ui.muted}>
                Chuyển khoản {formatVnd(today?.transfer ?? 0)} · Tiền mặt {formatVnd(today?.cash ?? 0)}
              </Text>
              {state.data.purchaseToday > 0 && (
                <Text style={[ui.muted, { marginTop: 6 }]}>📦 Đã chi hôm nay (tham khảo): {formatVnd(state.data.purchaseToday)}</Text>
              )}
            </View>

            {/* 2. Việc cần xử lý để doanh thu đúng. */}
            {state.data.unreviewed > 0 ? (
              <Pressable style={[ui.card, ui.cardWarn]} onPress={() => router.push('/giao-dich')} accessibilityRole="button">
                <Text style={[ui.h2, { color: colors.warn }]}>Còn {state.data.unreviewed} khoản chưa xem</Text>
                <Text style={ui.text}>Doanh thu chưa chốt. Chạm để tích khoản nào là tiền bán hàng.</Text>
              </Pressable>
            ) : (
              <View style={[ui.card, { backgroundColor: colors.primarySoft }]}>
                <Text style={[ui.text, { color: colors.primary }]}>✓ Đã xem hết các khoản</Text>
              </View>
            )}

            {state.data.gaps.map((g) => (
              <View key={`${g.source}${g.account}${g.to}`} style={[ui.card, ui.cardDanger]}>
                <Text style={[ui.h2, { color: colors.danger }]}>
                  Nghi sót giao dịch {g.source} {g.account}
                </Text>
                <Text style={ui.text}>
                  Lệch {formatVnd(g.missingAmount)} từ {formatTime(g.from)} đến {formatTime(g.to)}.
                </Text>
                <Pressable style={[ui.buttonGhost, { marginTop: 10, borderColor: colors.danger }]} onPress={() => onPatch(g)}>
                  <Text style={[ui.buttonGhostText, { color: colors.danger }]}>Vá khoản này</Text>
                </Pressable>
              </View>
            ))}

            {/* 3. Việc cần làm (ghi chú đang trong khung nhắc). */}
            {state.data.reminders.length > 0 && (
              <Pressable onPress={() => router.push('/lich')} accessibilityRole="button">
                <Text style={styles.section}>🔔 Cần làm ({state.data.reminders.length}) ›</Text>
              </Pressable>
            )}
            {state.data.reminders.map((n) => (
              <NoteCard key={n.id} note={n} onToggleDone={(x) => void mutate((d, owner) => setNoteDone(d, x.id, true, owner))} />
            ))}

            {/* 4. Thông tin thêm, gộp 1 thẻ: dịp sắp tới + người làm. */}
            {(state.data.occasions.length > 0 || state.data.hasPeople) && (
              <Pressable style={ui.card} onPress={() => router.push('/lich')} accessibilityRole="button">
                {state.data.occasions.map((o) => (
                  <Text key={o.daysAway} style={[ui.text, styles.occasion]}>
                    ★ {o.daysAway === 1 ? 'Ngày mai' : 'Ngày kia'} là {o.labels.join(', ')} ({o.lunar.day}/{o.lunar.month} âm) — nhớ
                    nhập thêm hàng cúng
                  </Text>
                ))}
                {state.data.hasPeople && <Text style={ui.text}>👥 Hôm nay — {state.data.workingToday}</Text>}
                {!!state.data.offTomorrow && (
                  <Text style={[ui.text, { color: colors.warn, fontWeight: '700', marginTop: 4 }]}>
                    Ngày mai: {state.data.offTomorrow}
                  </Text>
                )}
              </Pressable>
            )}
          </>
        )}

        {sync.state !== 'idle' && (
          <Text style={[ui.muted, { marginHorizontal: 16, marginTop: 16, color: sync.state === 'error' ? colors.danger : colors.muted }]}>
            {sync.message}
          </Text>
        )}
      </ScrollView>

      <View style={[ui.bottomBar, styles.bar]}>
        <Pressable style={[styles.fab, { flex: 1 }]} onPress={() => setCashOpen(true)} accessibilityRole="button" accessibilityLabel="Nhập tiền mặt">
          <Text style={styles.fabText}>+ Tiền mặt</Text>
        </Pressable>
        <Pressable
          style={[styles.fab, styles.fabBuy, { flex: 1 }]}
          onPress={() => setBuyOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Nhập hàng"
        >
          <Text style={styles.fabText}>+ Nhập hàng</Text>
        </Pressable>
      </View>

      <CashEntryModal
        visible={cashOpen}
        onClose={() => setCashOpen(false)}
        onSave={(amount) => mutate((d, owner) => addCashSale(d, amount, owner))}
      />
      {buyOpen && (
        <PurchaseFormModal
          initial={null}
          onClose={() => setBuyOpen(false)}
          onSave={(input) => mutate((d, owner) => savePurchase(d, null, input, owner))}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: 10 },
  section: { fontSize: 24, fontWeight: '700', color: colors.warn, marginHorizontal: 16, marginTop: 16 },
  // Nhắc rằm / lễ là tin vui: dùng vàng đậm, để màu đỏ chỉ dành cho việc cần xử lý.
  occasion: { color: '#9A6B00', fontWeight: '700', marginBottom: 6 },
  fab: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    elevation: 4,
  },
  fabBuy: { backgroundColor: '#1565C0' },
  fabText: { color: '#fff', fontSize: 24, fontWeight: '700' },
});
