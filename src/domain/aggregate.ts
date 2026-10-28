import { formatDayMonth } from './text';
import type { Period, Txn } from './types';

export type Shift = 'morning' | 'afternoon' | 'evening';

type SaleInput = Pick<Txn, 'source' | 'amount' | 'occurred_at' | 'is_sale' | 'deleted'>;

export type SalesSummary<T extends SaleInput = SaleInput> = {
  label: string;
  start: number;
  total: number;
  transfer: number;
  cash: number;
  count: number;
  byShift: Record<Shift, number>;
  // Các khoản đã cộng vào kỳ này, cũ trước.
  items: T[];
};

// Ca theo giờ máy: sáng trước 12:00, chiều 12:00–17:59, tối từ 18:00.
export function shiftOf(ts: number): Shift {
  const h = new Date(ts).getHours();
  if (h < 12) return 'morning';
  return h < 18 ? 'afternoon' : 'evening';
}

// Mốc bắt đầu kỳ theo giờ máy. Tuần bắt đầu từ thứ 2.
export function periodStart(ts: number, period: Period): Date {
  const d = new Date(ts);
  if (period === 'year') return new Date(d.getFullYear(), 0, 1);
  if (period === 'month') return new Date(d.getFullYear(), d.getMonth(), 1);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (period === 'week') day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

// Nhãn hiển thị của 1 kỳ: "27/10/2026", "26/10 – 01/11/2026", "Tháng 10/2026", "Năm 2026".
export function labelOf(start: Date, period: Period): string {
  const dm = formatDayMonth(start);
  if (period === 'day') return `${dm}/${start.getFullYear()}`;
  if (period === 'week') {
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${dm} – ${formatDayMonth(end)}/${end.getFullYear()}`;
  }
  if (period === 'month') return `Tháng ${start.getMonth() + 1}/${start.getFullYear()}`;
  return `Năm ${start.getFullYear()}`;
}

// Mốc bắt đầu dữ liệu cần tải cho màn báo cáo: 90 ngày / 52 tuần / 24 tháng / toàn bộ (năm).
export function reportRangeStart(now: number, period: Period): number {
  const start = periodStart(now, period);
  if (period === 'day') start.setDate(start.getDate() - 89);
  else if (period === 'week') start.setDate(start.getDate() - 51 * 7);
  else if (period === 'month') start.setMonth(start.getMonth() - 23);
  else return 0;
  return start.getTime();
}

// Khoản được tính doanh thu: đã tích bán hàng, tiền vào, chưa xoá.
// (SQL listSalesSince cũng lọc như vậy để tải ít dữ liệu; giữ ở đây để quy tắc có test.)
function isCountedSale(t: SaleInput): boolean {
  return t.is_sale === 1 && t.amount > 0 && t.deleted === 0;
}

// Tổng thu bán hàng theo kỳ (kèm tổng theo ca và danh sách khoản), mới nhất trước.
export function summarizeSales<T extends SaleInput>(txns: T[], period: Period): SalesSummary<T>[] {
  const map = new Map<number, SalesSummary<T>>();
  const sorted = [...txns].sort((a, b) => a.occurred_at - b.occurred_at);
  for (const t of sorted) {
    if (!isCountedSale(t)) continue;
    const start = periodStart(t.occurred_at, period);
    const key = start.getTime();
    const s = map.get(key) ?? {
      label: labelOf(start, period),
      start: key,
      total: 0,
      transfer: 0,
      cash: 0,
      count: 0,
      byShift: { morning: 0, afternoon: 0, evening: 0 },
      items: [],
    };
    s.total += t.amount;
    if (t.source === 'CASH') s.cash += t.amount;
    else s.transfer += t.amount;
    s.count += 1;
    s.byShift[shiftOf(t.occurred_at)] += t.amount;
    s.items.push(t);
    map.set(key, s);
  }
  return [...map.values()].sort((a, b) => b.start - a.start);
}
