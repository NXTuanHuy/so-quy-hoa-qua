import { periodStart, reportRangeStart, shiftOf, summarizeSales } from '../aggregate';

describe('shiftOf', () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 27, h, m).getTime();

  it('sáng trước 12:00, chiều 12:00–17:59, tối từ 18:00', () => {
    expect(shiftOf(at(0, 1))).toBe('morning');
    expect(shiftOf(at(11, 59))).toBe('morning');
    expect(shiftOf(at(12))).toBe('afternoon');
    expect(shiftOf(at(17, 59))).toBe('afternoon');
    expect(shiftOf(at(18))).toBe('evening');
    expect(shiftOf(at(23, 59))).toBe('evening');
  });
});

describe('reportRangeStart', () => {
  const now = new Date(2026, 9, 27, 15).getTime(); // thứ 3, 27/10/2026

  it('ngày: 90 ngày gần nhất tính cả hôm nay', () => {
    expect(reportRangeStart(now, 'day')).toBe(new Date(2026, 6, 30).getTime());
  });
  it('tuần: 52 tuần, bắt đầu từ thứ 2', () => {
    // thứ 2 tuần này = 26/10/2026, lùi 51 tuần → thứ 2, 03/11/2025
    expect(reportRangeStart(now, 'week')).toBe(new Date(2025, 10, 3).getTime());
  });
  it('tháng: 24 tháng', () => {
    expect(reportRangeStart(now, 'month')).toBe(new Date(2024, 10, 1).getTime());
  });
  it('năm: toàn bộ', () => {
    expect(reportRangeStart(now, 'year')).toBe(0);
  });
});

const t = (amount: number, at: Date, source: 'MB' | 'CASH' = 'MB', is_sale = 1, deleted = 0) => ({
  source,
  amount,
  occurred_at: at.getTime(),
  is_sale,
  deleted,
});

describe('periodStart', () => {
  it('tuần bắt đầu từ thứ 2, kể cả khi hôm nay là chủ nhật', () => {
    // 2026-11-01 là chủ nhật → thứ 2 là 2026-10-26
    expect(periodStart(new Date(2026, 10, 1, 20).getTime(), 'week')).toEqual(new Date(2026, 9, 26));
  });
});

describe('summarizeSales', () => {
  const txns = [
    t(100_000, new Date(2026, 9, 27, 9)),
    t(50_000, new Date(2026, 9, 27, 18), 'CASH'),
    t(70_000, new Date(2026, 9, 26, 8)),
    t(999_000, new Date(2026, 9, 27, 10), 'MB', 0), // cá nhân
    t(-30_000, new Date(2026, 9, 27, 11)), // tiền ra
    t(40_000, new Date(2026, 9, 27, 12), 'CASH', 1, 1), // đã xoá
  ];

  it('theo ngày: chỉ tính tiền bán hàng, tách chuyển khoản / tiền mặt, mới nhất trước', () => {
    const [today, yesterday] = summarizeSales(txns, 'day');
    expect(today).toMatchObject({ label: '27/10/2026', total: 150_000, transfer: 100_000, cash: 50_000, count: 2 });
    expect(yesterday).toMatchObject({ label: '26/10/2026', total: 70_000, count: 1 });
  });

  it('tách tổng theo ca và giữ danh sách khoản đã cộng, cũ trước', () => {
    const [today] = summarizeSales(txns, 'day');
    expect(today.byShift).toEqual({ morning: 100_000, afternoon: 0, evening: 50_000 });
    expect(today.items.map((i) => i.amount)).toEqual([100_000, 50_000]);
  });

  it('theo tuần / tháng / năm gộp đúng', () => {
    expect(summarizeSales(txns, 'week')).toHaveLength(1);
    expect(summarizeSales(txns, 'week')[0]).toMatchObject({ label: '26/10 – 01/11/2026', total: 220_000 });
    expect(summarizeSales(txns, 'month')[0]).toMatchObject({ label: 'Tháng 10/2026', total: 220_000 });
    expect(summarizeSales(txns, 'year')[0]).toMatchObject({ label: 'Năm 2026', total: 220_000 });
  });
});
