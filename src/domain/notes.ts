import { formatDayMonth } from './text';
import type { Note } from './types';

const pad = (n: number) => String(n).padStart(2, '0');
const DAY_MS = 24 * 60 * 60_000;

// Date → "YYYY-MM-DD" theo giờ máy.
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "YYYY-MM-DD" → 0 giờ ngày đó theo giờ máy.
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Khung hiện thẻ nhắc ở màn Hôm nay: từ 22:00 tối hôm trước đến 15:00 ngày đó (epoch ms).
export function reminderWindow(dueDate: string): { start: number; end: number } {
  const day = fromDateKey(dueDate);
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1, 22);
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 15);
  return { start: start.getTime(), end: end.getTime() };
}

// Việc chưa xong, chưa xoá và đang trong khung nhắc.
export function isReminding(n: Pick<Note, 'due_date' | 'done' | 'deleted'>, now: number): boolean {
  if (n.done === 1 || n.deleted === 1) return false;
  const { start, end } = reminderWindow(n.due_date);
  return now >= start && now < end;
}

const WEEKDAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

// "Hôm nay, 29/10" / "Ngày mai, 30/10" / "Hôm qua, 28/10" / "Thứ 2, 02/11".
export function formatDueDate(dueDate: string, now: number): string {
  const day = fromDateKey(dueDate);
  const today = fromDateKey(toDateKey(new Date(now)));
  const diff = Math.round((day.getTime() - today.getTime()) / DAY_MS);
  const name = diff === 0 ? 'Hôm nay' : diff === 1 ? 'Ngày mai' : diff === -1 ? 'Hôm qua' : WEEKDAYS[day.getDay()];
  return `${name}, ${formatDayMonth(day)}`;
}
