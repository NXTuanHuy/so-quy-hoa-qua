import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { STAR_COLOR } from '@/components/MonthCalendar';
import { NoteCard } from '@/components/NoteCard';
import { NoteFormModal } from '@/components/NoteFormModal';
import { PurchaseFormModal } from '@/components/PurchaseFormModal';
import { PurchaseRow } from '@/components/PurchaseRow';
import { AsyncStatus } from '@/components/StateView';
import { deleteNote, listNotesBetween, saveNote, setNoteDone } from '@/data/notes';
import { addPerson, listDayOffs, listPeople, setDayOff } from '@/data/people';
import { deletePurchase, listPurchasesBetween, savePurchase, setPurchasePaid } from '@/data/purchases';
import { listSalesSince } from '@/data/repo';
import { summarizeSales } from '@/domain/aggregate';
import { attendanceOn, workingText } from '@/domain/calendar';
import { canChiYear, markDay } from '@/domain/lunar';
import { formatDueDate, fromDateKey } from '@/domain/notes';
import { formatVnd } from '@/domain/text';
import type { DayPart, Note, PaidBy, Purchase } from '@/domain/types';
import { useAsync } from '@/hooks/useAsync';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { useApp } from '@/state/AppContext';
import { colors, ui } from '@/ui/theme';

const PARTS: { value: DayPart; label: string }[] = [
  { value: 'NONE', label: 'Đi làm' },
  { value: 'AM', label: 'Nghỉ sáng' },
  { value: 'PM', label: 'Nghỉ chiều' },
  { value: 'FULL', label: 'Nghỉ cả ngày' },
];

// Chi tiết 1 ngày: âm lịch + dịp lễ, tổng doanh thu, nhập hàng, chủ báo nghỉ / nhân viên đi làm, ghi chú.
export function DayDetailModal({ dateKey, onClose }: { dateKey: string; onClose: () => void }) {
  const { db, version, mutate } = useApp();
  // null = đóng form; 'new' = thêm mới; Note = đang sửa.
  const [editing, setEditing] = useState<Note | 'new' | null>(null);
  // Form nhập hàng: null = đóng; 'new' = thêm mới; Purchase = đang sửa.
  const [buying, setBuying] = useState<Purchase | 'new' | null>(null);
  // Mốc "hôm nay" lấy 1 lần khi mở.
  const [now] = useState(() => Date.now());
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  // null = không đang gõ tên nhân viên mới.
  const [newStaff, setNewStaff] = useState<string | null>(null);
  const day = fromDateKey(dateKey);
  const mark = markDay(day);

  const state = useAsync(async () => {
    const d = fromDateKey(dateKey);
    const start = d.getTime();
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    const [sales, notes, people, offs, purchases] = await Promise.all([
      listSalesSince(db, start),
      listNotesBetween(db, dateKey, dateKey),
      listPeople(db),
      listDayOffs(db, dateKey, dateKey),
      listPurchasesBetween(db, dateKey, dateKey),
    ]);
    const partOf = new Map(offs.map((o) => [o.person_id, o.part]));
    return {
      summary: summarizeSales(sales.filter((s) => s.occurred_at < end), 'day')[0],
      notes,
      purchases,
      purchaseTotal: purchases.reduce((sum, p) => sum + p.amount, 0),
      attendance: attendanceOn(people, offs),
      owners: people.filter((p) => p.role === 'OWNER').map((p) => ({ person: p, part: partOf.get(p.id) ?? 'NONE' })),
      staff: people.filter((p) => p.role === 'STAFF').map((p) => ({ person: p, working: partOf.get(p.id) === 'WORK' })),
    };
  }, [db, version, dateKey]);

  const setPart = (personId: string, part: DayPart) =>
    void mutate((d, owner) => setDayOff(d, dateKey, personId, part, owner));

  // Thêm nhân viên mới vào danh sách và ghi luôn là đi làm hôm nay.
  const addStaffToday = async () => {
    const name = newStaff?.trim();
    if (!name) return;
    const ok = await mutate(async (d, owner) => {
      const id = await addPerson(d, name, 'STAFF', owner);
      await setDayOff(d, dateKey, id, 'WORK', owner);
    });
    if (ok) setNewStaff(null);
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

  const onPaid = useCallback(
    (p: Purchase, paid: PaidBy) => void mutate((d, owner) => setPurchasePaid(d, p.id, paid, owner)),
    [mutate],
  );
  const onDeletePurchase = useCallback(
    (p: Purchase) =>
      Alert.alert('Xoá lần nhập hàng?', `“${p.item}” sẽ bị xoá trên cả 2 máy.`, [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Xoá', style: 'destructive', onPress: () => void mutate((d, owner) => deletePurchase(d, p.id, owner)) },
      ]),
    [mutate],
  );

  const summary = state.data?.summary;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <ScrollView
        style={ui.screen}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 40 + insets.bottom + keyboard }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {formatDueDate(dateKey, now)}/{day.getFullYear()}
            </Text>
            <Text style={styles.lunar}>
              Âm lịch: {mark.lunar.day}/{mark.lunar.month}
              {mark.lunar.leap ? ' (nhuận)' : ''} · năm {canChiYear(mark.lunar.year)}
            </Text>
          </View>
          <Pressable style={ui.buttonGhost} onPress={onClose} accessibilityRole="button">
            <Text style={ui.buttonGhostText}>Đóng</Text>
          </Pressable>
        </View>
        {mark.star && (
          <Text style={[styles.occasion, { color: STAR_COLOR[mark.star] }]}>★ {mark.labels.join(' · ')}</Text>
        )}

        <AsyncStatus state={state} />

        {state.data && (
          <>
            <View style={ui.card}>
              <Text style={ui.h2}>Doanh thu bán hàng</Text>
              <Text style={styles.total}>{formatVnd(summary?.total ?? 0)}</Text>
            </View>

            <View style={[ui.card, styles.notesHead]}>
              <View style={{ flex: 1 }}>
                <Text style={ui.h2}>Đã chi: hàng, thuê nhà ({state.data.purchases.length})</Text>
                <Text style={styles.buyTotal}>{formatVnd(state.data.purchaseTotal)}</Text>
              </View>
              <Pressable style={ui.button} onPress={() => setBuying('new')} accessibilityRole="button">
                <Text style={ui.buttonText}>+ Chi</Text>
              </Pressable>
            </View>
            {state.data.purchases.map((p) => (
              <PurchaseRow key={p.id} purchase={p} onEdit={setBuying} onDelete={onDeletePurchase} onPaid={onPaid} />
            ))}

            <View style={ui.card}>
              <Text style={ui.h2}>Người làm</Text>
              <Text style={styles.working}>{workingText(state.data.attendance)}</Text>

              <Text style={styles.section}>Chủ cửa hàng</Text>
              {state.data.owners.length === 0 && <Text style={styles.detail}>Chưa có. Thêm ở tab Cài đặt.</Text>}
              {state.data.owners.map(({ person, part }) => (
                <View key={person.id} style={styles.person}>
                  <Text style={styles.personName}>{person.name}</Text>
                  <View style={styles.parts}>
                    {PARTS.map((p) => {
                      const on = p.value === part;
                      return (
                        <Pressable
                          key={p.value}
                          style={[styles.part, on && (p.value === 'NONE' ? styles.partWork : styles.partOff)]}
                          onPress={() => setPart(person.id, p.value)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: on }}
                        >
                          <Text style={[styles.partText, on && { color: '#fff' }]}>{p.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}

              <Text style={styles.section}>Nhân viên đi làm hôm nay (chạm để thêm / bỏ)</Text>
              <View style={styles.parts}>
                {state.data.staff.map(({ person, working }) => (
                  <Pressable
                    key={person.id}
                    style={[styles.part, working && styles.partWork]}
                    onPress={() => setPart(person.id, working ? 'NONE' : 'WORK')}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: working }}
                  >
                    <Text style={[styles.partText, working && { color: '#fff' }]}>
                      {working ? '✓ ' : '+ '}
                      {person.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {newStaff === null ? (
                <Pressable style={[ui.buttonGhost, { marginTop: 10 }]} onPress={() => setNewStaff('')} accessibilityRole="button">
                  <Text style={ui.buttonGhostText}>+ Nhân viên mới</Text>
                </Pressable>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    value={newStaff}
                    onChangeText={setNewStaff}
                    placeholder="Tên nhân viên"
                    autoFocus
                  />
                  <View style={styles.parts}>
                    <Pressable style={[ui.buttonGhost, { flex: 1 }]} onPress={() => setNewStaff(null)} accessibilityRole="button">
                      <Text style={ui.buttonGhostText}>Huỷ</Text>
                    </Pressable>
                    <Pressable
                      style={[ui.button, { flex: 2, opacity: newStaff.trim() ? 1 : 0.5 }]}
                      onPress={addStaffToday}
                      disabled={!newStaff.trim()}
                      accessibilityRole="button"
                    >
                      <Text style={ui.buttonText}>Thêm & đi làm hôm nay</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>

            <View style={[ui.card, styles.notesHead]}>
              <Text style={ui.h2}>Ghi chú ({state.data.notes.length})</Text>
              <Pressable style={ui.button} onPress={() => setEditing('new')} accessibilityRole="button">
                <Text style={ui.buttonText}>+ Ghi chú</Text>
              </Pressable>
            </View>
            {state.data.notes.map((n) => (
              <NoteCard key={n.id} note={n} onToggleDone={onToggleDone} onEdit={setEditing} onDelete={onDelete} />
            ))}
          </>
        )}
      </ScrollView>

      {editing !== null && (
        <NoteFormModal
          initial={editing === 'new' ? null : editing}
          defaultDate={dateKey}
          onClose={() => setEditing(null)}
          onSave={(input) => mutate((d, owner) => saveNote(d, editing === 'new' ? null : editing.id, input, owner))}
        />
      )}
      {buying !== null && (
        <PurchaseFormModal
          initial={buying === 'new' ? null : buying}
          defaultDate={dateKey}
          onClose={() => setBuying(null)}
          onSave={(input) => mutate((d, owner) => savePurchase(d, buying === 'new' ? null : buying.id, input, owner))}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 20 },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  lunar: { fontSize: 22, color: colors.muted, marginTop: 4 },
  occasion: { fontSize: 24, fontWeight: '700', marginHorizontal: 16, marginTop: 8 },
  total: { fontSize: 36, fontWeight: '700', color: colors.primary, marginVertical: 4 },
  buyTotal: { fontSize: 26, fontWeight: '700', color: colors.muted, marginTop: 2 },
  detail: { fontSize: 22, color: colors.muted },
  working: { fontSize: 22, fontWeight: '600', color: colors.text, marginVertical: 6 },
  section: { fontSize: 20, fontWeight: '700', color: colors.muted, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 22,
    marginVertical: 10,
    color: colors.text,
  },
  person: { marginTop: 12 },
  personName: { fontSize: 24, fontWeight: '700', color: colors.text },
  parts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  part: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  partWork: { backgroundColor: colors.primary, borderColor: colors.primary },
  partOff: { backgroundColor: colors.warn, borderColor: colors.warn },
  partText: { fontSize: 20, fontWeight: '600', color: colors.text },
  notesHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
