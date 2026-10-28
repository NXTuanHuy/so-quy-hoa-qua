import type { SQLiteDatabase } from 'expo-sqlite';

import { isReminding, toDateKey } from '@/domain/notes';
import type { Note } from '@/domain/types';
import { writeTx } from './db';
import { NOTE_CONTENT_COLS } from './lww';
import { newId } from './repo';

// Phần nội dung người dùng nhập trong form ghi chú.
export type NoteInput = Pick<Note, 'kind' | 'due_date' | 'item' | 'quantity' | 'person' | 'address' | 'phone' | 'note'>;

// Ghi chú chưa xoá có hạn trong khoảng ngày [from, to] ("YYYY-MM-DD"), dùng cho lịch tháng.
export function listNotesBetween(db: SQLiteDatabase, from: string, to: string): Promise<Note[]> {
  return db.getAllAsync<Note>(
    'SELECT * FROM notes WHERE deleted = 0 AND due_date BETWEEN ? AND ? ORDER BY due_date, done, updated_at',
    from,
    to,
  );
}

// Ghi chú chưa xoá. done = false: việc chưa xong, ngày gần trước; done = true: việc đã xong, mới xong trước (tối đa 200).
export function listNotes(db: SQLiteDatabase, done: boolean): Promise<Note[]> {
  return db.getAllAsync<Note>(
    done
      ? 'SELECT * FROM notes WHERE deleted = 0 AND done = 1 ORDER BY done_at DESC LIMIT 200'
      : 'SELECT * FROM notes WHERE deleted = 0 AND done = 0 ORDER BY due_date, updated_at',
  );
}

// Việc đang trong khung nhắc (22:00 hôm trước → 15:00 ngày đó) để hiện ở màn Hôm nay.
export async function listRemindingNotes(db: SQLiteDatabase, now: number): Promise<Note[]> {
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  const today = toDateKey(new Date(now));
  const tomorrow = toDateKey(next);
  const rows = await db.getAllAsync<Note>(
    'SELECT * FROM notes WHERE deleted = 0 AND done = 0 AND due_date IN (?, ?) ORDER BY due_date, updated_at',
    today,
    tomorrow,
  );
  return rows.filter((n) => isReminding(n, now));
}

// Thêm ghi chú mới (id = null) hoặc sửa nội dung ghi chú có sẵn.
export function saveNote(db: SQLiteDatabase, id: string | null, input: NoteInput, owner: string): Promise<void> {
  const now = Date.now();
  const values = NOTE_CONTENT_COLS.map((c) => input[c].trim());
  return writeTx(db, async () => {
    if (id === null) {
      await db.runAsync(
        `INSERT INTO notes (id, ${NOTE_CONTENT_COLS.join(', ')}, content_at, updated_at, updated_by)
         VALUES (?, ${NOTE_CONTENT_COLS.map(() => '?').join(', ')}, ?, ?, ?)`,
        newId(), ...values, now, now, owner,
      );
    } else {
      await db.runAsync(
        `UPDATE notes SET ${NOTE_CONTENT_COLS.map((c) => `${c} = ?`).join(', ')},
           content_at = ?, updated_at = ?, updated_by = ?, synced = 0 WHERE id = ?`,
        ...values, now, now, owner, id,
      );
    }
  });
}

// Đánh dấu đã xong / chưa xong.
export function setNoteDone(db: SQLiteDatabase, id: string, done: boolean, owner: string): Promise<void> {
  const now = Date.now();
  return writeTx(db, async () => {
    await db.runAsync(
      'UPDATE notes SET done = ?, done_at = ?, updated_at = ?, updated_by = ?, synced = 0 WHERE id = ?',
      done ? 1 : 0, now, now, owner, id,
    );
  });
}

// Xoá mềm để máy kia cũng ẩn theo khi đồng bộ.
export function deleteNote(db: SQLiteDatabase, id: string, owner: string): Promise<void> {
  const now = Date.now();
  return writeTx(db, async () => {
    await db.runAsync(
      'UPDATE notes SET deleted = 1, deleted_at = ?, updated_at = ?, updated_by = ?, synced = 0 WHERE id = ?',
      now, now, owner, id,
    );
  });
}
