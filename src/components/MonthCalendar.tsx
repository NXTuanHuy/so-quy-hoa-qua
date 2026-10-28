import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { attendanceOn, formatCompactVnd, initialOf, isWorking, monthGrid, someoneOff } from '@/domain/calendar';
import { markDay } from '@/domain/lunar';
import { toDateKey } from '@/domain/notes';
import type { DayOff, Person } from '@/domain/types';
import { colors } from '@/ui/theme';

export type DayInfo = { revenue: number; purchase: number; notes: number; offs: DayOff[] };

type Props = {
  year: number;
  month: number; // 0–11
  today: string; // "YYYY-MM-DD"
  days: Map<string, DayInfo>;
  people: Person[];
  onSelect: (dateKey: string) => void;
};

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
export const STAR_COLOR = { red: colors.danger, yellow: '#E0A800' } as const;

// Lịch tháng: ngày dương + âm, sao đỏ (rằm / mùng 1) / vàng (trước 1 ngày, ngày lễ), doanh thu, tiền nhập, người đi làm, số việc.
export const MonthCalendar = memo(function MonthCalendar({ year, month, today, days, people, onSelect }: Props) {
  const weeks = useMemo(
    () => monthGrid(year, month).map((w) => w.map((d) => (d ? { date: d, key: toDateKey(d), mark: markDay(d) } : null))),
    [year, month],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={[styles.weekday, w === 'CN' && { color: colors.danger }]}>
            {w}
          </Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.row}>
          {week.map((cell, ci) => {
            if (!cell) return <View key={ci} style={styles.cell} />;
            const info = days.get(cell.key);
            const list = attendanceOn(people, info?.offs ?? []);
            const working = list.filter(isWorking);
            const anyOff = someoneOff(list);
            const { lunar, star } = cell.mark;
            return (
              <Pressable
                key={ci}
                style={({ pressed }) => [styles.cell, cell.key === today && styles.today, pressed && { opacity: 0.6 }]}
                onPress={() => onSelect(cell.key)}
                accessibilityRole="button"
                accessibilityLabel={`Ngày ${cell.date.getDate()}, âm ${lunar.day}/${lunar.month}`}
              >
                <View style={styles.top}>
                  <Text style={[styles.solar, ci === 6 && { color: colors.danger }]}>{cell.date.getDate()}</Text>
                  {star && <Text style={[styles.star, { color: STAR_COLOR[star] }]}>★</Text>}
                </View>
                <Text style={[styles.lunar, lunar.day === 1 && styles.lunarFirst]}>
                  {lunar.day === 1 ? `1/${lunar.month}` : lunar.day}
                </Text>
                {!!info?.revenue && <Text style={styles.revenue}>{formatCompactVnd(info.revenue)}</Text>}
                {!!info?.purchase && <Text style={styles.purchase}>📦{formatCompactVnd(info.purchase)}</Text>}
                {people.length > 0 && (
                  <Text style={[styles.small, anyOff && { color: colors.warn, fontWeight: '700' }]} numberOfLines={1}>
                    {working.length ? working.map((a) => initialOf(a.person.name)).join('·') : 'Nghỉ'}
                  </Text>
                )}
                {!!info?.notes && <Text style={styles.small}>📝{info.notes}</Text>}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 8, marginTop: 8, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', paddingVertical: 6, fontSize: 16, fontWeight: '700', color: colors.muted },
  cell: {
    flex: 1,
    minHeight: 96,
    padding: 3,
    borderTopWidth: 1,
    borderColor: colors.bg,
  },
  today: { borderWidth: 2, borderColor: colors.primary, borderRadius: 8 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  solar: { fontSize: 20, fontWeight: '700', color: colors.text },
  star: { fontSize: 16 },
  lunar: { fontSize: 13, color: colors.muted },
  lunarFirst: { color: colors.danger, fontWeight: '700' },
  revenue: { fontSize: 13, fontWeight: '700', color: colors.primary },
  purchase: { fontSize: 12, color: colors.muted },
  small: { fontSize: 12, color: colors.muted },
});
