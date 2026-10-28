import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatVnd } from '@/domain/text';
import { colors, ui } from '@/ui/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  // Trả về true nếu đã lưu (lỗi do người gọi báo) → đóng bàn phím.
  onSave: (amount: number) => Promise<boolean>;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', '⌫'];
const MAX_DIGITS = 10;

// Các tờ tiền chọn nhanh. Ảnh PNG được xuất từ assets/vnd-*.svg (React Native không hiển thị SVG sẵn).
const NOTES = [
  { value: 500_000, image: require('../../assets/vnd-500000.png') },
  { value: 200_000, image: require('../../assets/vnd-200000.png') },
  { value: 100_000, image: require('../../assets/vnd-100000.png') },
  { value: 50_000, image: require('../../assets/vnd-50000.png') },
  { value: 20_000, image: require('../../assets/vnd-20000.png') },
  { value: 10_000, image: require('../../assets/vnd-10000.png') },
  { value: 5_000, image: require('../../assets/vnd-5000.png') },
  { value: 2_000, image: require('../../assets/vnd-2000.png') },
  { value: 1_000, image: require('../../assets/vnd-1000.png') },
];

// Bàn phím số to để nhập tiền mặt bán hàng: mở (chạm 1) → chạm tờ tiền / gõ số → Lưu (chạm 2).
// Số tiền = tổng các tờ đã chọn + số gõ tay.
export function CashEntryModal({ visible, onClose, onSave }: Props) {
  const [digits, setDigits] = useState('');
  // Các tờ tiền đã chạm, theo thứ tự chạm (để quay lại / xoá từng tờ).
  const [picked, setPicked] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const insets = useSafeAreaInsets();
  const typed = Number(digits || '0');
  const amount = picked.reduce((sum, v) => sum + v, typed);

  const press = (key: string) => {
    if (key === '⌫') return setDigits((d) => d.slice(0, -1));
    setDigits((d) => (d + key).replace(/^0+/, '').slice(0, MAX_DIGITS));
  };

  // Chạm tờ tiền → thêm vào danh sách đã chọn (bỏ qua nếu tổng vượt quá số chữ số tối đa).
  const addNote = (value: number) => {
    if (String(amount + value).length > MAX_DIGITS) return;
    setPicked((p) => [...p, value]);
  };

  const clearAll = () => {
    setDigits('');
    setPicked([]);
  };

  const close = () => {
    clearAll();
    onClose();
  };

  const save = async () => {
    if (amount <= 0) return;
    setSaving(true);
    const ok = await onSave(amount);
    setSaving(false);
    if (ok) close();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
      <View style={[styles.backdrop, { paddingTop: insets.top }]}>
        <View style={styles.sheet}>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
          <Text style={ui.muted}>Tiền mặt bán hàng</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit accessibilityLiveRegion="polite">
              {formatVnd(amount)}
            </Text>
            {amount > 0 && (
              <Pressable onPress={clearAll} hitSlop={8} accessibilityRole="button" accessibilityLabel="Xoá hết">
                <Text style={styles.clear}>✕</Text>
              </Pressable>
            )}
          </View>

          {picked.length > 0 && (
            <View style={styles.picked}>
              <View style={styles.pickedHeader}>
                <Text style={styles.pickedTitle}>Đã chọn (chạm để bỏ):</Text>
                <Pressable
                  onPress={() => setPicked((p) => p.slice(0, -1))}
                  style={styles.undo}
                  accessibilityRole="button"
                  accessibilityLabel="Bỏ tờ vừa chọn"
                >
                  <Text style={styles.undoText}>↶ Quay lại</Text>
                </Pressable>
              </View>
              <View style={styles.chips}>
                {picked.map((v, i) => (
                  <Pressable
                    key={i}
                    onPress={() => setPicked((p) => p.filter((_, j) => j !== i))}
                    style={styles.chip}
                    accessibilityRole="button"
                    accessibilityLabel={`Bỏ ${formatVnd(v)}`}
                  >
                    <Text style={styles.chipText}>{formatVnd(v)} ✕</Text>
                  </Pressable>
                ))}
                {typed > 0 && (
                  <View style={[styles.chip, styles.chipTyped]}>
                    <Text style={styles.chipText}>+ gõ tay {formatVnd(typed)}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={styles.grid}>
            {NOTES.map((n) => (
              <Pressable
                key={n.value}
                onPress={() => addNote(n.value)}
                style={({ pressed }) => [styles.note, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel={`Cộng ${formatVnd(n.value)}`}
              >
                <Image source={n.image} style={styles.noteImage} resizeMode="contain" />
              </Pressable>
            ))}
          </View>

          <View style={styles.grid}>
            {KEYS.map((k) => (
              <Pressable
                key={k}
                onPress={() => press(k)}
                style={({ pressed }) => [styles.key, pressed && { backgroundColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel={k === '⌫' ? 'Xoá' : k}
              >
                <Text style={styles.keyText}>{k}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

          {/* Nút cố định dưới đáy, chừa thanh điều hướng của máy → không phải cuộn mới thấy. */}
          <View style={[styles.actions, { paddingBottom: 12 + insets.bottom }]}>
            <Pressable style={[ui.buttonGhost, { flex: 1 }]} onPress={close} accessibilityRole="button">
              <Text style={ui.buttonGhostText}>Huỷ</Text>
            </Pressable>
            <Pressable
              style={[ui.button, { flex: 2, opacity: amount > 0 && !saving ? 1 : 0.5 }]}
              onPress={save}
              disabled={amount <= 0 || saving}
              accessibilityRole="button"
            >
              <Text style={ui.buttonText}>{saving ? 'Đang lưu…' : 'Lưu'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '100%', backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12 },
  amount: { flex: 1, fontSize: 52, fontWeight: '700', color: colors.text },
  clear: { fontSize: 32, color: colors.muted, paddingHorizontal: 8 },
  picked: { marginBottom: 12, padding: 10, borderRadius: 12, backgroundColor: colors.bg },
  pickedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pickedTitle: { flex: 1, fontSize: 20, color: colors.muted },
  undo: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.primary },
  undoText: { fontSize: 22, fontWeight: '700', color: colors.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipTyped: { borderStyle: 'dashed' },
  chipText: { fontSize: 22, fontWeight: '600', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  note: { width: '31.5%', aspectRatio: 160 / 76, marginBottom: 8 },
  noteImage: { width: '100%', height: '100%' },
  key: {
    width: '31.5%',
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  keyText: { fontSize: 32, fontWeight: '600', color: colors.text },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
