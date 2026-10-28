import { formatVnd, normalizeText, parseLocalDateTime, parseVnd } from '../text';

describe('parseVnd', () => {
  it.each([
    ['5,123,000', 5123000],
    ['5.123.000', 5123000],
    ['200,000.00', 200000],
    ['500', 500],
  ])('%s → %d', (raw, expected) => {
    expect(parseVnd(raw)).toBe(expected);
  });

  it('trả NaN khi không có số', () => {
    expect(parseVnd('abc')).toBeNaN();
  });
});

describe('normalizeText', () => {
  it('bỏ dấu tiếng Việt và gộp khoảng trắng', () => {
    expect(normalizeText('Số  dư:  Đà Nẵng')).toBe('So du: Da Nang');
  });
});

describe('formatVnd', () => {
  it('nhóm hàng nghìn bằng dấu chấm', () => {
    expect(formatVnd(1234000)).toBe('1.234.000 đ');
    expect(formatVnd(-50000)).toBe('-50.000 đ');
    expect(formatVnd(0)).toBe('0 đ');
  });
});

describe('parseLocalDateTime', () => {
  it('đọc năm 2 chữ số', () => {
    expect(parseLocalDateTime('18/05/26', '09:12')).toBe(new Date(2026, 4, 18, 9, 12).getTime());
  });
  it('từ chối ngày không tồn tại', () => {
    expect(parseLocalDateTime('31/02/2026', '09:12')).toBeNull();
  });
});
