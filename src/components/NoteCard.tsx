import { memo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDueDate, toDateKey } from '@/domain/notes';
import type { Note } from '@/domain/types';
import { colors, ui } from '@/ui/theme';

type Props = {
  note: Note;
  onToggleDone: (note: Note) => void;
  // Không truyền → ẩn nút (ví dụ ở màn Hôm nay).
  onEdit?: (note: Note) => void;
  onDelete?: (note: Note) => void;
};

export const KIND_LABEL: Record<Note['kind'], string> = { DELIVERY: '🚚 Giao bán', IMPORT: '📦 Nhập hàng' };

// 1 ghi chú nhắc việc: loại, ngày, hàng + số lượng, người / địa chỉ / SĐT (chạm để gọi), nút Xong / Sửa / Xoá.
export const NoteCard = memo(function NoteCard({ note, onToggleDone, onEdit, onDelete }: Props) {
  const now = Date.now();
  const done = note.done === 1;
  const overdue = !done && note.due_date < toDateKey(new Date(now));

  return (
    <View style={[ui.card, done && styles.done, overdue && ui.cardDanger]}>
      <View style={styles.rowBetween}>
        <Text style={styles.kind}>{KIND_LABEL[note.kind]}</Text>
        <Text style={[styles.date, overdue && { color: colors.danger }]}>
          {overdue ? 'Trễ · ' : ''}
          {formatDueDate(note.due_date, now)}
        </Text>
      </View>

      <Text style={styles.item}>
        {note.item}
        {note.quantity ? ` · ${note.quantity}` : ''}
      </Text>
      {!!note.person && <Text style={styles.line}>{note.kind === 'DELIVERY' ? 'Người mua' : 'Nhập ở'}: {note.person}</Text>}
      {!!note.address && <Text style={styles.line}>Địa chỉ: {note.address}</Text>}
      {!!note.phone && (
        <Pressable onPress={() => Linking.openURL(`tel:${note.phone}`)} accessibilityRole="link" accessibilityLabel={`Gọi ${note.phone}`}>
          <Text style={[styles.line, styles.phone]}>📞 {note.phone}</Text>
        </Pressable>
      )}
      {!!note.note && <Text style={styles.line}>Ghi chú: {note.note}</Text>}
      {!!note.updated_by && <Text style={styles.by}>Người ghi/sửa cuối: {note.updated_by}</Text>}

      <View style={styles.actions}>
        <Pressable
          style={[done ? ui.buttonGhost : ui.button, { flex: 2 }]}
          onPress={() => onToggleDone(note)}
          accessibilityRole="button"
        >
          <Text style={done ? ui.buttonGhostText : ui.buttonText}>{done ? '↶ Chưa xong' : '✓ Đã xong'}</Text>
        </Pressable>
        {onEdit && (
          <Pressable style={[ui.buttonGhost, { flex: 1 }]} onPress={() => onEdit(note)} accessibilityRole="button">
            <Text style={ui.buttonGhostText}>Sửa</Text>
          </Pressable>
        )}
        {onDelete && (
          <Pressable
            style={[ui.buttonGhost, { flex: 1, borderColor: colors.danger }]}
            onPress={() => onDelete(note)}
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
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  kind: { fontSize: 20, fontWeight: '700', color: colors.primary },
  date: { fontSize: 20, fontWeight: '600', color: colors.text },
  item: { fontSize: 28, fontWeight: '700', color: colors.text, marginTop: 6 },
  line: { fontSize: 22, color: colors.text, marginTop: 4 },
  phone: { color: colors.primary, fontWeight: '700', textDecorationLine: 'underline' },
  by: { fontSize: 18, color: colors.muted, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  done: { opacity: 0.6 },
});
