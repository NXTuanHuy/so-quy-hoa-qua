import { canChiYear, markDay, toLunar, upcomingOccasions } from '../lunar';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe('toLunar', () => {
  it('đúng các ngày Tết đã biết', () => {
    expect(toLunar(d(2024, 2, 10))).toEqual({ day: 1, month: 1, year: 2024, leap: false });
    expect(toLunar(d(2025, 1, 29))).toEqual({ day: 1, month: 1, year: 2025, leap: false });
    expect(toLunar(d(2026, 2, 17))).toEqual({ day: 1, month: 1, year: 2026, leap: false });
  });

  it('ngày cuối năm âm thuộc năm âm trước', () => {
    expect(toLunar(d(2026, 2, 16))).toMatchObject({ month: 12, year: 2025 });
  });

  it('Trung thu và Vu Lan 2025 (năm có tháng 6 nhuận)', () => {
    expect(toLunar(d(2025, 10, 6))).toEqual({ day: 15, month: 8, year: 2025, leap: false });
    expect(toLunar(d(2025, 9, 6))).toEqual({ day: 15, month: 7, year: 2025, leap: false });
  });

  it('nhận ra tháng nhuận', () => {
    expect(toLunar(d(2025, 8, 1)).leap).toBe(true); // tháng 6 nhuận Ất Tỵ
  });
});

describe('canChiYear', () => {
  it('tên năm', () => {
    expect(canChiYear(2024)).toBe('Giáp Thìn');
    expect(canChiYear(2025)).toBe('Ất Tỵ');
    expect(canChiYear(2026)).toBe('Bính Ngọ');
  });
});

describe('markDay', () => {
  it('rằm và mùng 1 là sao đỏ, ngày trước đó 1 ngày là sao vàng', () => {
    expect(markDay(d(2025, 10, 6))).toMatchObject({ star: 'red', labels: ['Trung thu'] });
    expect(markDay(d(2025, 10, 5))).toMatchObject({ star: 'yellow', labels: ['Trước rằm'] });
    expect(markDay(d(2026, 2, 17))).toMatchObject({ star: 'red', labels: ['Tết Nguyên Đán'] });
    expect(markDay(d(2026, 2, 16))).toMatchObject({ star: 'yellow', labels: ['Trước mùng 1'] });
  });

  it('ngày lễ (không phải rằm / mùng 1) là sao vàng', () => {
    expect(markDay(d(2026, 2, 18))).toMatchObject({ star: 'yellow', labels: ['Mùng 2 Tết'] });
    expect(markDay(d(2026, 9, 2))).toMatchObject({ star: 'yellow' });
    expect(markDay(d(2026, 9, 2)).labels).toContain('Quốc khánh');
  });

  it('ngày thường không có sao', () => {
    expect(markDay(d(2025, 10, 10))).toMatchObject({ star: null, labels: [] });
  });
});

describe('upcomingOccasions', () => {
  it('nhắc rằm trong 2 ngày tới, bỏ nhãn "Trước…"', () => {
    // Trung thu 2025 = 06/10; từ 04/10 thấy nó ở "ngày kia"
    expect(upcomingOccasions(d(2025, 10, 4), 2)).toEqual([
      { daysAway: 2, date: d(2025, 10, 6), lunar: { day: 15, month: 8, year: 2025, leap: false }, labels: ['Trung thu'] },
    ]);
  });

  it('không có dịp nào → rỗng', () => {
    expect(upcomingOccasions(d(2025, 10, 9), 2)).toEqual([]);
  });
});
