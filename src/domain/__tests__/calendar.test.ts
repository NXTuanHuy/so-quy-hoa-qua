import {
  attendanceOn,
  formatCompactVnd,
  initialOf,
  monthGrid,
  offText,
  someoneOff,
  workingText,
} from '../calendar';
import type { Person, PersonRole } from '../types';

describe('monthGrid', () => {
  it('tháng 10/2026 bắt đầu thứ 5, tuần bắt đầu thứ 2', () => {
    const grid = monthGrid(2026, 9);
    expect(grid[0].slice(0, 3)).toEqual([null, null, null]);
    expect(grid[0][3]).toEqual(new Date(2026, 9, 1));
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid.flat().filter(Boolean)).toHaveLength(31);
  });
});

describe('formatCompactVnd', () => {
  it('viết gọn', () => {
    expect(formatCompactVnd(0)).toBe('0');
    expect(formatCompactVnd(850_000)).toBe('850k');
    expect(formatCompactVnd(2_400_000)).toBe('2,4tr');
    expect(formatCompactVnd(3_000_000)).toBe('3tr');
    expect(formatCompactVnd(1_250_000_000)).toBe('1,3 tỷ');
  });
});

describe('đi làm / nghỉ', () => {
  const p = (id: string, name: string, role: PersonRole = 'OWNER'): Person => ({
    id, name, role, deleted: 0, name_at: 0, deleted_at: 0, updated_at: 0, updated_by: '',
  });
  const people = [p('a', 'Chủ Lan'), p('b', 'Hùng'), p('s1', 'Tú', 'STAFF'), p('s2', 'Mai', 'STAFF')];

  it('mặc định: 2 chủ đi làm, nhân viên không có mặt', () => {
    const list = attendanceOn(people, []);
    expect(workingText(list)).toBe('Đi làm: Chủ Lan, Hùng');
    expect(offText(list)).toBe('');
    expect(someoneOff(list)).toBe(false);
  });

  it('chủ nghỉ cả ngày → chỉ hiện người đi làm; nghỉ nửa ngày vẫn hiện kèm ghi chú', () => {
    expect(workingText(attendanceOn(people, [{ person_id: 'a', part: 'FULL' }]))).toBe('Đi làm: Hùng');
    const half = attendanceOn(people, [{ person_id: 'b', part: 'PM' }]);
    expect(workingText(half)).toBe('Đi làm: Chủ Lan, Hùng (nghỉ chiều)');
    expect(offText(half)).toBe('Hùng nghỉ chiều');
    expect(someoneOff(half)).toBe(true);
  });

  it('nhân viên chỉ có mặt ngày được thêm', () => {
    const list = attendanceOn(people, [
      { person_id: 'a', part: 'FULL' },
      { person_id: 's1', part: 'WORK' },
      { person_id: 's2', part: 'NONE' },
    ]);
    expect(workingText(list)).toBe('Đi làm: Hùng, Tú');
    expect(offText(list)).toBe('Chủ Lan nghỉ');
  });

  it('cả 2 chủ nghỉ, không có nhân viên', () => {
    const list = attendanceOn(people, [
      { person_id: 'a', part: 'FULL' },
      { person_id: 'b', part: 'FULL' },
    ]);
    expect(workingText(list)).toBe('Không ai đi làm');
  });

  it('chữ cái đầu của tên gọi', () => {
    expect(initialOf('Chủ Lan')).toBe('L');
    expect(initialOf(' hùng ')).toBe('H');
  });
});
