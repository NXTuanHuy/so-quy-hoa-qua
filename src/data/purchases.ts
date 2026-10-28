import type { SQLiteDatabase } from 'expo-sqlite';

import type { PaidBy, Purchase } from '@/domain/types';
import { writeTx } from './db';
import { PURCHASE_CONTENT_COLS } from './lww';
import { newId } from './repo';

// Phần người dùng nhập trong form chi (nhập hàng / thuê nhà).
export type PurchaseInput = Pick<Purchase, 'category' | 'date' | 'item' | 'quantity' | 'amount' | 'supplier' | 'note' | 'paid'>;

// Lần nhập hàng chưa xoá trong khoảng ngày [from, to] ("YYYY-MM-DD"), cũ trước.
export function listPurchasesBetween(db: SQLiteDatabase, from: string, to: string): Promise<Purchase[]> {
  return db.getAllAsync<Purchase>(
    'SELECT * FROM purchases WHERE deleted = 0 AND date BETWEEN ? AND ? ORDER BY date, updated_at',
    from,
    to,
  );
}

// Các khoản nhập hàng còn nợ (mọi ngày).
export function listDebtPurchases(db: SQLiteDatabase): Promise<Purchase[]> {
  return db.getAllAsync<Purchase>("SELECT * FROM purchases WHERE deleted = 0 AND paid = 'DEBT' ORDER BY date");
}

// Thêm (id = null) hoặc sửa 1 lần nhập hàng.
export function savePurchase(db: SQLiteDatabase, id: string | null, input: PurchaseInput, owner: string): Promise<void> {
  const now = Date.now();
  const content = PURCHASE_CONTENT_COLS.map((c) => {
    const v = input[c];
    return typeof v === 'string' ? v.trim() : v;
  });
  return writeTx(db, async () => {
    if (id === null) {
      await db.runAsync(
        `INSERT INTO purchases (id, ${PURCHASE_CONTENT_COLS.join(', ')}, paid, content_at, paid_at, updated_at, updated_by)
         VALUES (?, ${PURCHASE_CONTENT_COLS.map(() => '?').join(', ')}, ?, ?, ?, ?, ?)`,
        newId(), ...content, input.paid, now, now, now, owner,
      );
    } else {
      await db.runAsync(
        `UPDATE purchases SET ${PURCHASE_CONTENT_COLS.map((c) => `${c} = ?`).join(', ')}, paid = ?,
           content_at = ?, paid_at = ?, updated_at = ?, updated_by = ?, synced = 0 WHERE id = ?`,
        ...content, input.paid, now, now, now, owner, id,
      );
    }
  });
}

// Đổi cách trả tiền (ví dụ trả nợ: DEBT → CASH).
export function setPurchasePaid(db: SQLiteDatabase, id: string, paid: PaidBy, owner: string): Promise<void> {
  const now = Date.now();
  return writeTx(db, async () => {
    await db.runAsync(
      'UPDATE purchases SET paid = ?, paid_at = ?, updated_at = ?, updated_by = ?, synced = 0 WHERE id = ?',
      paid, now, now, owner, id,
    );
  });
}

// Xoá mềm để máy kia cũng ẩn theo.
export function deletePurchase(db: SQLiteDatabase, id: string, owner: string): Promise<void> {
  const now = Date.now();
  return writeTx(db, async () => {
    await db.runAsync(
      'UPDATE purchases SET deleted = 1, deleted_at = ?, updated_at = ?, updated_by = ?, synced = 0 WHERE id = ?',
      now, now, owner, id,
    );
  });
}
