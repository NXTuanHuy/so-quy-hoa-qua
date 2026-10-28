import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDueDate, fromDateKey, toDateKey } from '@/domain/notes';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { colors, ui } from '@/ui/theme';

// Lùi / tiến `days` ngày từ 1 ngày dạng "YYYY-MM-DD".
export const shiftDay = (key: string, days: number) => {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
};

type FormModalProps = {
  title: string;
  canSave: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
};

// Khung form toàn màn hình: thanh Huỷ / tiêu đề / Lưu cố định trên cùng; phần dưới cuộn được, chừa chỗ cho bàn phím.
export function FormModal({ title, canSave, saving, onClose, onSave, children }: FormModalProps) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={[ui.screen, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Pressable style={ui.buttonGhost} onPress={onClose} accessibilityRole="button">
            <Text style={ui.buttonGhostText}>Huỷ</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Pressable
            style={[ui.button, { opacity: canSave && !saving ? 1 : 0.5 }]}
            onPress={onSave}
            disabled={!canSave || saving}
            accessibilityRole="button"
          >
            <Text style={ui.buttonText}>{saving ? 'Đang lưu…' : 'Lưu'}</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 + insets.bottom + keyboard }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

// Chọn ngày bằng ◀ ▶ + nút nhanh "Hôm nay" / "Ngày mai". `today` = "YYYY-MM-DD", `now` = mốc để gọi tên ngày.
export function DateStepper({ value, onChange, today, now }: { value: string; onChange: (v: string) => void; today: string; now: number }) {
  return (
    <View style={ui.card}>
      <Text style={styles.label}>Ngày</Text>
      <View style={styles.dateRow}>
        <Pressable style={styles.step} onPress={() => onChange(shiftDay(value, -1))} accessibilityLabel="Lùi 1 ngày">
          <Text style={styles.stepText}>◀</Text>
        </Pressable>
        <Text style={styles.dateText}>{formatDueDate(value, now)}</Text>
        <Pressable style={styles.step} onPress={() => onChange(shiftDay(value, 1))} accessibilityLabel="Tiến 1 ngày">
          <Text style={styles.stepText}>▶</Text>
        </Pressable>
      </View>
      <View style={styles.quick}>
        <Pressable style={ui.buttonGhost} onPress={() => onChange(today)}>
          <Text style={ui.buttonGhostText}>Hôm nay</Text>
        </Pressable>
        <Pressable style={ui.buttonGhost} onPress={() => onChange(shiftDay(today, 1))}>
          <Text style={ui.buttonGhostText}>Ngày mai</Text>
        </Pressable>
      </View>
    </View>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
  multiline?: boolean;
  // Dòng nhỏ dưới ô (ví dụ số tiền đã định dạng).
  hint?: string;
};

// 1 ô nhập có nhãn, chữ to.
export function Field({ label, value, onChange, placeholder, keyboardType = 'default', multiline = false, hint }: FieldProps) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { minHeight: 90, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
      />
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { flex: 1, textAlign: 'center', fontSize: 24, fontWeight: '700', color: colors.text },
  label: { fontSize: 20, fontWeight: '600', color: colors.text, marginBottom: 6 },
  hint: { fontSize: 22, fontWeight: '700', color: colors.primary, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 22,
    color: colors.text,
    backgroundColor: colors.card,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  step: { width: 56, height: 56, borderRadius: 12, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 26, color: colors.primary },
  dateText: { flex: 1, textAlign: 'center', fontSize: 24, fontWeight: '700', color: colors.text },
  quick: { flexDirection: 'row', gap: 8, marginTop: 10 },
});
