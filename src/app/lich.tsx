import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DayDetailModal } from '@/components/DayDetailModal';
import { MonthCalendar, STAR_COLOR, type DayInfo } from '@/components/MonthCalendar';
import { NoteCard } from '@/components/NoteCard';
import { NoteFormModal } from '@/components/NoteFormModal';
import { WeekList } from '@/components/WeekList';
import { Segmented } from '@/components/Segmented';
import { AsyncStatus, EmptyText } from '@/components/StateView';
import { deleteNote, listNotes, listNotesBetween, saveNote, setNoteDone } from '@/data/notes';
import { listDayOffs, listPeople } from '@/data/people';
import { listPurchasesBetween } from '@/data/purchases';
import { listSalesSince } from '@/data/repo';
import { periodStart, summarizeSales } from '@/domain/aggregate';
import { formatDayMonth } from '@/domain/text';
import { toLunar } from '@/domain/lunar';
import { toDateKey } from '@/domain/notes';
import type { Note } from '@/domain/types';
import { useAsync } from '@/hooks/useAsync';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useApp } from '@/state/AppContext';
import { colors, ui } from '@/ui/theme';

const FILTERS = [
  { value: false, label: 'Việc chưa xong' },
  { value: true, label: 'Đã xong' },
];

type ViewMode = 'month' | 'week';

const MODES: { value: ViewMode; label: string }[] = [
  { value: 'month', label: 'Tháng' },
  { value: 'week', label: 'Tuần (chữ to)' },
];

// Mốc đầu kỳ chứa `d`: ngày 1 của tháng, hoặc thứ 2 của tuần.
const startOf = (mode: ViewMode, d: Date) => periodStart(d.getTime(), mode);

// Màn "Lịch": lịch âm dương theo tháng hoặc tuần (chạm ngày → doanh thu, chi, người làm, ghi chú) + danh sách việc.
export default function CalendarScreen() {
  const { db, version, mutate } = useApp();
  const [today] = useState(() => toDateKey(new Date()));
  const [mode, setMode] = useState<ViewMode>('month');
  // Mốc đang xem: tháng thì là ngày 1, tuần thì là thứ 2 đầu tuần.
  const [anchor, setAnchor] = useState(() => startOf('month', new Date()));
  const [selected, setSelected] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  // null = đóng form; 'new' = thêm mới; Note = đang sửa.
  const [editing, setEditing] = useState<Note | 'new' | null>(null);
  const { refreshing, onRefresh } = usePullRefresh();
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  // Ngày cuối kỳ đang xem.
  const last = useMemo(
    () => (mode === 'month' ? new Date(year, month + 1, 0) : new Date(year, month, anchor.getDate() + 6)),
    [mode, year, month, anchor],
  );

  // Dữ liệu cả kỳ đang xem (tháng hoặc tuần) cho các ô / dòng lịch.
  const monthState = useAsync(async () => {
    const first = anchor;
    const next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    const from = toDateKey(first);
    const to = toDateKey(last);
    const [sales, notes, offs, people, purchases] = await Promise.all([
      listSalesSince(db, first.getTime()),
      listNotesBetween(db, from, to),
      listDayOffs(db, from, to),
      listPeople(db),
      listPurchasesBetween(db, from, to),
    ]);
    const days = new Map<string, DayInfo>();
    const get = (key: string) => {
      const d = days.get(key) ?? { revenue: 0, purchase: 0, notes: 0, offs: [] };
      days.set(key, d);
      return d;
    };
    for (const s of summarizeSales(sales.filter((x) => x.occurred_at < next.getTime()), 'day')) {
      get(toDateKey(new Date(s.start))).revenue = s.total;
    }
    for (const n of notes) if (n.done === 0) get(n.due_date).notes += 1;
    for (const o of offs) get(o.date).offs.push(o);
    for (const p of purchases) get(p.date).purchase += p.amount;
    return { days, people };
  }, [db, version, anchor, last]);

  const notesState = useAsync(() => listNotes(db, showDone), [db, version, showDone]);

  const lunarRange = useMemo(() => {
    const a = toLunar(anchor);
    const b = toLunar(last);
    return a.month === b.month ? `tháng ${a.month} âm` : `tháng ${a.month} – ${b.month} âm`;
  }, [anchor, last]);

  const title =
    mode === 'month' ? `Tháng ${month + 1}/${year}` : `${formatDayMonth(anchor)} – ${formatDayMonth(last)}/${last.getFullYear()}`;

  // Lùi / tiến 1 tháng hoặc 1 tuần.
  const shift = (delta: number) =>
    setAnchor((a) =>
      mode === 'month' ? new Date(a.getFullYear(), a.getMonth() + delta, 1) : new Date(a.getFullYear(), a.getMonth(), a.getDate() + 7 * delta),
    );

  const changeMode = (m: ViewMode) => {
    setMode(m);
    setAnchor(startOf(m, new Date()));
  };

  const onToggleDone = useCallback(
    (n: Note) => void mutate((d, owner) => setNoteDone(d, n.id, n.done !== 1, owner)),
    [mutate],
  );
  const onDelete = useCallback(
    (n: Note) =>
      Alert.alert('Xoá ghi chú?', `“${n.item}” sẽ bị xoá trên cả 2 máy.`, [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Xoá', style: 'destructive', onPress: () => void mutate((d, owner) => deleteNote(d, n.id, owner)) },
      ]),
    [mutate],
  );

  return (
    <View style={ui.screen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Segmented options={MODES} value={mode} onChange={changeMode} />
        <View style={styles.monthBar}>
          <Pressable style={styles.nav} onPress={() => shift(-1)} accessibilityLabel={mode === 'month' ? 'Tháng trước' : 'Tuần trước'}>
            <Text style={styles.navText}>◀</Text>
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => setAnchor(startOf(mode, new Date()))}>
            <Text style={styles.monthTitle}>{title}</Text>
            <Text style={styles.monthSub}>
              {lunarRange} · chạm để về {mode === 'month' ? 'tháng' : 'tuần'} này
            </Text>
          </Pressable>
          <Pressable style={styles.nav} onPress={() => shift(1)} accessibilityLabel={mode === 'month' ? 'Tháng sau' : 'Tuần sau'}>
            <Text style={styles.navText}>▶</Text>
          </Pressable>
        </View>

        <AsyncStatus state={monthState} />
        {monthState.data &&
          (mode === 'month' ? (
            <MonthCalendar
              year={year}
              month={month}
              today={today}
              days={monthState.data.days}
              people={monthState.data.people}
              onSelect={setSelected}
            />
          ) : (
            <WeekList
              start={anchor}
              today={today}
              days={monthState.data.days}
              people={monthState.data.people}
              onSelect={setSelected}
            />
          ))}
        {mode === 'month' && (
          <Text style={styles.legend}>
            <Text style={{ color: STAR_COLOR.red }}>★</Text> rằm / mùng 1 · <Text style={{ color: STAR_COLOR.yellow }}>★</Text> trước 1
            ngày, ngày lễ · <Text style={{ color: colors.primary }}>xanh</Text> = thu · 📦 = đã chi · chữ cái = người đi làm
          </Text>
        )}

        <Segmented options={FILTERS} value={showDone} onChange={setShowDone} variant="chip" />
        <AsyncStatus state={notesState} />
        {notesState.data?.length === 0 && (
          <EmptyText>{showDone ? 'Chưa có việc nào xong' : 'Không có việc nào cần làm'}</EmptyText>
        )}
        {notesState.data?.map((n) => (
          <NoteCard key={n.id} note={n} onToggleDone={onToggleDone} onEdit={setEditing} onDelete={onDelete} />
        ))}
      </ScrollView>

      <Pressable style={[ui.bottomBar, styles.fab]} onPress={() => setEditing('new')} accessibilityRole="button">
        <Text style={styles.fabText}>+ Ghi chú</Text>
      </Pressable>

      {selected && <DayDetailModal dateKey={selected} onClose={() => setSelected(null)} />}
      {editing !== null && (
        <NoteFormModal
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(input) => mutate((d, owner) => saveNote(d, editing === 'new' ? null : editing.id, input, owner))}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  monthBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 8, marginTop: 12 },
  nav: { width: 56, height: 56, borderRadius: 12, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 26, color: colors.primary },
  monthTitle: { fontSize: 28, fontWeight: '700', color: colors.text, textAlign: 'center' },
  monthSub: { fontSize: 16, color: colors.muted, textAlign: 'center' },
  legend: { fontSize: 16, color: colors.muted, marginHorizontal: 12, marginTop: 6 },
  fab: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 20, alignItems: 'center', elevation: 4 },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '700' },
});
