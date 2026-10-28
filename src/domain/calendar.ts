import type { DayPart, Person } from './types';

// Lưới tháng bắt đầu từ thứ 2: mỗi hàng 7 ô, ô ngoài tháng = null.
export function monthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

// Số tiền viết gọn cho ô lịch: 850.000 → "850k", 2.400.000 → "2,4tr", 1.250.000.000 → "1,3 tỷ".
export function formatCompactVnd(amount: number): string {
  const one = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',');
  if (amount >= 1_000_000_000) return `${one(amount / 1_000_000_000)} tỷ`;
  if (amount >= 1_000_000) return `${one(amount / 1_000_000)}tr`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}k`;
  return String(amount);
}

export type Attendance = { person: Person; part: DayPart };

/**
 * Tình trạng từng người trong 1 ngày: mọi chủ (mặc định đi làm) + nhân viên có được thêm (WORK).
 * Nhân viên không được thêm hôm đó thì không có trong danh sách.
 */
export function attendanceOn(people: Person[], entries: { person_id: string; part: DayPart }[]): Attendance[] {
  const byPerson = new Map(entries.map((e) => [e.person_id, e.part]));
  return people.flatMap((person) => {
    const part = byPerson.get(person.id) ?? 'NONE';
    if (person.role === 'STAFF') return part === 'WORK' ? [{ person, part }] : [];
    return [{ person, part }];
  });
}

// Có đi làm (ít nhất nửa ngày) không.
export const isWorking = (a: Attendance) => a.part !== 'FULL';

const PART_LABEL: Record<DayPart, string> = { NONE: '', WORK: '', AM: 'nghỉ sáng', PM: 'nghỉ chiều', FULL: 'nghỉ' };
const isOff = (a: Attendance) => a.part === 'AM' || a.part === 'PM' || a.part === 'FULL';

// "Đi làm: Lan, Hùng (nghỉ chiều), Tú" — người nghỉ cả ngày không có trong danh sách đi làm.
export function workingText(list: Attendance[]): string {
  const working = list.filter(isWorking);
  if (working.length === 0) return 'Không ai đi làm';
  return `Đi làm: ${working.map((a) => (isOff(a) ? `${a.person.name} (${PART_LABEL[a.part]})` : a.person.name)).join(', ')}`;
}

// "Lan nghỉ, Hùng nghỉ sáng" — rỗng nếu không ai nghỉ.
export function offText(list: Attendance[]): string {
  return list
    .filter(isOff)
    .map((a) => `${a.person.name} ${PART_LABEL[a.part]}`)
    .join(', ');
}

// Có chủ nào nghỉ (cả ngày hoặc nửa ngày) không — để tô màu ô lịch.
export const someoneOff = (list: Attendance[]) => list.some(isOff);

// Chữ cái đầu của tên gọi (từ cuối): "Chủ Lan" → "L". Dùng trong ô lịch nhỏ.
export function initialOf(name: string): string {
  const last = name.trim().split(/\s+/).at(-1) ?? '';
  return last.charAt(0).toUpperCase();
}
