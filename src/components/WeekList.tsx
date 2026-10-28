import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DayInfo } from '@/components/MonthCalendar';
import { STAR_COLOR } from '@/components/MonthCalendar';
import { attendanceOn, formatCompactVnd, workingText } from '@/domain/calendar';
import { markDay } from '@/domain/lunar';
import { toDateKey } from '@/domain/notes';
import { formatDayMonth, formatVnd } from '@/domain/text';
import type { Person } from '@/domain/types';
import { colors, ui } from '@/ui/theme';

type Props = {
  start: Date; // thứ 2 đầu tuần
  today: string; // "YYYY-MM-DD"
  days: Map<string, DayInfo>;
  people: Person[];
  onSelect: (dateKey: string) => void;
};

const WEEKDAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

// Lịch 1 tuần dạng danh sách chữ to: mỗi ngày 1 dòng (thứ, ngày dương / âm, dịp lễ, doanh thu, người đi làm, chi, việc).
export const WeekList = memo(function WeekList({ start, today, days, people, onSelect }: Props) {
  const rows = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        return { date, key: toDateKey(date), mark: markDay(date) };
      }),
    [start],
  );

  return (
    <View>
      {rows.map(({ date, key, mark }) => {
        const info = days.get(key);
        const { lunar, star, labels } = mark;
        return (
          <Pressable
            key={key}
            style={({ pressed }) => [ui.card, styles.row, key === today && styles.today, pressed && { opacity: 0.6 }]}
            onPress={() => onSelect(key)}
            accessibilityRole="button"
          >
            <View style={styles.head}>
              <Text style={[styles.day, date.getDay() === 0 && { color: colors.danger }]}>
                {WEEKDAYS[date.getDay()]}, {formatDayMonth(date)}
              </Text>
              <Text style={styles.revenue}>{formatVnd(info?.revenue ?? 0)}</Text>
            </View>
            <Text style={styles.lunar}>
              Âm {lunar.day}/{lunar.month}
              {star && <Text style={{ color: STAR_COLOR[star], fontWeight: '700' }}> ★ {labels.join(', ')}</Text>}
            </Text>
            {people.length > 0 && <Text style={styles.line}>{workingText(attendanceOn(people, info?.offs ?? []))}</Text>}
            {(!!info?.purchase || !!info?.notes) && (
              <Text style={styles.line}>
                {info?.purchase ? `📦 Đã chi ${formatCompactVnd(info.purchase)}` : ''}
                {info?.purchase && info?.notes ? ' · ' : ''}
                {info?.notes ? `📝 ${info.notes} việc` : ''}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { marginTop: 8 },
  today: { borderColor: colors.primary, borderWidth: 2 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  day: { fontSize: 24, fontWeight: '700', color: colors.text },
  revenue: { fontSize: 24, fontWeight: '700', color: colors.primary },
  lunar: { fontSize: 20, color: colors.muted, marginTop: 2 },
  line: { fontSize: 20, color: colors.text, marginTop: 4 },
});
