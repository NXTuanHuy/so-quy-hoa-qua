import { formatDueDate, fromDateKey, isReminding, reminderWindow, toDateKey } from '../notes';

describe('date key', () => {
  it('đổi qua lại giữa Date và "YYYY-MM-DD" theo giờ máy', () => {
    expect(toDateKey(new Date(2026, 9, 30, 23, 59))).toBe('2026-10-30');
    expect(fromDateKey('2026-10-30')).toEqual(new Date(2026, 9, 30));
  });
});

describe('reminderWindow', () => {
  it('từ 22:00 tối hôm trước đến 15:00 ngày đó', () => {
    expect(reminderWindow('2026-10-30')).toEqual({
      start: new Date(2026, 9, 29, 22).getTime(),
      end: new Date(2026, 9, 30, 15).getTime(),
    });
  });

  it('qua đầu tháng vẫn lùi đúng 1 ngày', () => {
    expect(reminderWindow('2026-11-01').start).toBe(new Date(2026, 9, 31, 22).getTime());
  });
});

describe('isReminding', () => {
  const n = { due_date: '2026-10-30', done: 0, deleted: 0 };
  const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();

  it('chỉ nhắc trong khung giờ', () => {
    expect(isReminding(n, at(29, 21, 59))).toBe(false);
    expect(isReminding(n, at(29, 22))).toBe(true);
    expect(isReminding(n, at(30, 9))).toBe(true);
    expect(isReminding(n, at(30, 14, 59))).toBe(true);
    expect(isReminding(n, at(30, 15))).toBe(false);
  });

  it('không nhắc việc đã xong hoặc đã xoá', () => {
    expect(isReminding({ ...n, done: 1 }, at(30, 9))).toBe(false);
    expect(isReminding({ ...n, deleted: 1 }, at(30, 9))).toBe(false);
  });
});

describe('formatDueDate', () => {
  const now = new Date(2026, 9, 29, 10).getTime(); // thứ 5, 29/10/2026

  it('gọi tên hôm nay / ngày mai / hôm qua, còn lại là thứ + ngày', () => {
    expect(formatDueDate('2026-10-29', now)).toBe('Hôm nay, 29/10');
    expect(formatDueDate('2026-10-30', now)).toBe('Ngày mai, 30/10');
    expect(formatDueDate('2026-10-28', now)).toBe('Hôm qua, 28/10');
    expect(formatDueDate('2026-11-01', now)).toBe('Chủ nhật, 01/11');
    expect(formatDueDate('2026-11-02', now)).toBe('Thứ 2, 02/11');
  });
});
