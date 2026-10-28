import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, ui } from '@/ui/theme';

type Props<T> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  // "bar" = thanh chia đều chiều ngang; "chip" = các nút bo tròn đứng cạnh nhau.
  variant?: 'bar' | 'chip';
};

// Chọn 1 trong vài lựa chọn (tab). Dùng cho bộ lọc giao dịch và kỳ báo cáo.
export function Segmented<T extends string | boolean>({ options, value, onChange, variant = 'bar' }: Props<T>) {
  const chip = variant === 'chip';
  return (
    <View style={chip ? styles.chips : styles.bar} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={[chip ? styles.chip : styles.barItem, on && styles.on]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text style={[ui.text, styles.label, on && styles.onText]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  barItem: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  chips: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  label: { fontSize: 24 },
  on: { backgroundColor: colors.primary, borderColor: colors.primary },
  onText: { color: '#fff', fontWeight: '600' },
});
