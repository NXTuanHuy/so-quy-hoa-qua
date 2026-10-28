import type { SQLiteDatabase } from 'expo-sqlite';

import type { DayOff, DayPart, Person, PersonRole } from '@/domain/types';
import { writeTx } from './db';
import { newId } from './repo';

// Người làm chưa bị bỏ: chủ trước, rồi theo tên.
export function listPeople(db: SQLiteDatabase): Promise<Person[]> {
  return db.getAllAsync<Person>("SELECT * FROM people WHERE deleted = 0 ORDER BY role = 'STAFF', name");
}

// Thêm 1 người (chủ hoặc nhân viên) vào danh sách; trả về id mới.
export async function addPerson(db: SQLiteDatabase, name: string, role: PersonRole, owner: string): Promise<string> {
  const now = Date.now();
  const id = newId();
  await writeTx(db, async () => {
    await db.runAsync(
      'INSERT INTO people (id, name, role, name_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)',
      id, name.trim(), role, now, now, owner,
    );
  });
  return id;
}

// Bỏ 1 người khỏi danh sách (xoá mềm để máy kia cũng bỏ theo).
export function removePerson(db: SQLiteDatabase, id: string, owner: string): Promise<void> {
  const now = Date.now();
  return writeTx(db, async () => {
    await db.runAsync(
      'UPDATE people SET deleted = 1, deleted_at = ?, updated_at = ?, updated_by = ?, synced = 0 WHERE id = ?',
      now, now, owner, id,
    );
  });
}

// Trạng thái (nghỉ của chủ / đi làm của nhân viên) trong khoảng ngày [from, to] ("YYYY-MM-DD").
export function listDayOffs(db: SQLiteDatabase, from: string, to: string): Promise<DayOff[]> {
  return db.getAllAsync<DayOff>("SELECT * FROM day_off WHERE part <> 'NONE' AND date BETWEEN ? AND ?", from, to);
}

// Đặt trạng thái của 1 người trong 1 ngày (xem DayPart). Id cố định theo ngày + người.
export function setDayOff(db: SQLiteDatabase, date: string, personId: string, part: DayPart, owner: string): Promise<void> {
  const now = Date.now();
  return writeTx(db, async () => {
    await db.runAsync(
      `INSERT INTO day_off (id, date, person_id, part, part_at, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET part = excluded.part, part_at = excluded.part_at,
         updated_at = excluded.updated_at, updated_by = excluded.updated_by, synced = 0`,
      `${date}|${personId}`, date, personId, part, now, now, owner,
    );
  });
}
