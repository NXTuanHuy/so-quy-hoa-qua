import type { SQLiteDatabase } from 'expo-sqlite';

import { extractCounterparty } from '@/domain/counterparty';
import { bankTxnId } from '@/domain/parseBankNotification';
import type { BalanceGap } from '@/domain/reconcile';
import type { EditHistory, ParsedBankTxn, RawBankNotification, Txn } from '@/domain/types';
import { placeholders, writeTx } from './db';

// Id ngẫu nhiên đủ dùng cho tiền mặt / lịch sử sửa / ghi chú (không cần chuẩn UUID).
export const newId =() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// ---------- kv ----------

// Ghi 1 cặp key/value. Dùng trực tiếp bên trong writeTx (không tự khoá).
export const KV_UPSERT = 'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value';

// Đọc 1 giá trị cấu hình cục bộ (tên chủ, mốc đồng bộ…); null nếu chưa có.
export async function getKv(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  return row?.value ?? null;
}

// Ghi (hoặc ghi đè) 1 giá trị cấu hình cục bộ.
export function setKv(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  return writeTx(db, async () => {
    await db.runAsync(KV_UPSERT, key, value);
  });
}

// ---------- đọc ----------

// Danh sách giao dịch chưa xoá, mới nhất trước (tối đa 500). onlyUnreviewed = chỉ khoản chưa xem.
export function listTransactions(db: SQLiteDatabase, onlyUnreviewed: boolean): Promise<Txn[]> {
  return db.getAllAsync<Txn>(
    `SELECT * FROM transactions WHERE deleted = 0 ${onlyUnreviewed ? 'AND reviewed = 0' : ''}
     ORDER BY occurred_at DESC LIMIT 500`,
  );
}

export type SaleRow = Pick<Txn, 'id' | 'source' | 'amount' | 'occurred_at' | 'description' | 'is_sale' | 'deleted'>;

// Các khoản được tính doanh thu từ mốc `since` (epoch ms) — chỉ lấy cột cần cho báo cáo.
export function listSalesSince(db: SQLiteDatabase, since: number): Promise<SaleRow[]> {
  return db.getAllAsync<SaleRow>(
    `SELECT id, source, amount, occurred_at, description, is_sale, deleted FROM transactions
     WHERE is_sale = 1 AND amount > 0 AND deleted = 0 AND occurred_at >= ?`,
    since,
  );
}

export type BankRow = Pick<Txn, 'source' | 'account' | 'amount' | 'balance_after' | 'occurred_at'>;

// Giao dịch ngân hàng từ mốc `since`, dùng để đối soát số dư.
export function listBankRowsSince(db: SQLiteDatabase, since: number): Promise<BankRow[]> {
  return db.getAllAsync<BankRow>(
    `SELECT source, account, amount, balance_after, occurred_at FROM transactions
     WHERE source <> 'CASH' AND deleted = 0 AND occurred_at >= ?`,
    since,
  );
}

// Số khoản chưa xem (chưa phân loại xong).
export async function countUnreviewed(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM transactions WHERE reviewed = 0 AND deleted = 0');
  return row?.n ?? 0;
}

// Lịch sử sửa của 1 giao dịch, mới nhất trước.
export function getHistory(db: SQLiteDatabase, transactionId: string): Promise<EditHistory[]> {
  return db.getAllAsync<EditHistory>(
    'SELECT * FROM edit_history WHERE transaction_id = ? ORDER BY changed_at DESC',
    transactionId,
  );
}

// 50 thông báo gần nhất mà bộ đọc không hiểu, để gửi mẫu cho dev.
export function listUnparsed(db: SQLiteDatabase) {
  return db.getAllAsync<{ id: number; package_name: string; title: string; text: string; posted_at: number }>(
    'SELECT id, package_name, title, text, posted_at FROM unparsed_notifications ORDER BY posted_at DESC LIMIT 50',
  );
}

// ---------- ghi ----------

// Lưu giao dịch ngân hàng mới. Trùng id thì bỏ qua (thông báo lặp hoặc 2 máy cùng nhận).
// Người chuyển đã từng được tích bán hàng → tự gợi ý is_sale = 1 nhưng vẫn chưa xem.
// Các trường *_at = 0 để bất kỳ lần sửa tay nào cũng thắng giá trị ban đầu khi đồng bộ.
export function insertBankTxns(db: SQLiteDatabase, txns: ParsedBankTxn[], owner: string): Promise<number> {
  if (!txns.length) return Promise.resolve(0);
  const rows = txns.map((t) => ({ t, counterparty: t.amount > 0 ? extractCounterparty(t.description) : null }));
  const names = [...new Set(rows.flatMap((r) => (r.counterparty ? [r.counterparty] : [])))];

  return writeTx(db, async () => {
    // Chỉ tra những người chuyển có trong lô này.
    const known = names.length
      ? await db.getAllAsync<{ counterparty: string }>(
          `SELECT DISTINCT counterparty FROM transactions
           WHERE is_sale = 1 AND source <> 'CASH' AND counterparty IN (${placeholders(names.length)})`,
          ...names,
        )
      : [];
    const saleSenders = new Set(known.map((k) => k.counterparty));
    const now = Date.now();
    let inserted = 0;
    for (const { t, counterparty } of rows) {
      const suggested = counterparty !== null && saleSenders.has(counterparty) ? 1 : 0;
      const res = await db.runAsync(
        `INSERT OR IGNORE INTO transactions
          (id, source, account, amount, balance_after, occurred_at, description, counterparty,
           is_sale, reviewed, deleted, updated_at, updated_by, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0)`,
        bankTxnId(t), t.source, t.account, t.amount, t.balanceAfter, t.occurredAt, t.description, counterparty,
        suggested, t.amount > 0 ? 0 : 1, now, owner,
      );
      inserted += res.changes;
    }
    return inserted;
  });
}

// Lưu thông báo không đọc được để người dùng gửi mẫu.
export function insertUnparsed(db: SQLiteDatabase, items: RawBankNotification[]): Promise<void> {
  if (!items.length) return Promise.resolve();
  return writeTx(db, async () => {
    for (const n of items) {
      await db.runAsync(
        'INSERT INTO unparsed_notifications (package_name, title, text, posted_at) VALUES (?, ?, ?, ?)',
        n.packageName, n.title, n.text, n.postedAt,
      );
    }
  });
}

// Ghi 1 khoản tiền mặt bán hàng (đã xem, tính doanh thu ngay).
export function addCashSale(db: SQLiteDatabase, amount: number, owner: string): Promise<void> {
  return writeTx(db, async () => {
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO transactions (id, source, account, amount, occurred_at, description, is_sale, reviewed, updated_at, updated_by)
       VALUES (?, 'CASH', '', ?, ?, 'Tiền mặt', 1, 1, ?, ?)`,
      newId(), amount, now, now, owner,
    );
  });
}

// Thêm 1 giao dịch nhập tay để vá chỗ lệch số dư; để "chưa xem" cho chủ tự quyết có phải bán hàng không.
export function patchGap(db: SQLiteDatabase, gap: BalanceGap, owner: string): Promise<void> {
  return writeTx(db, async () => {
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO transactions (id, source, account, amount, balance_after, occurred_at, description, is_sale, reviewed, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, 'Nhập tay: vá khoản bị sót (có thể gồm nhiều giao dịch)', 0, ?, ?, ?)`,
      newId(), gap.source, gap.account, gap.missingAmount, gap.previousBalance + gap.missingAmount,
      Math.round((gap.from + gap.to) / 2), gap.missingAmount > 0 ? 0 : 1, now, owner,
    );
  });
}

type EditableField = 'is_sale' | 'deleted';

// Sửa 1 trường (kèm thời điểm sửa của riêng trường đó), coi như đã xem, đánh dấu cần đồng bộ và ghi lịch sử.
function updateField(db: SQLiteDatabase, id: string, field: EditableField, value: number, owner: string): Promise<void> {
  return writeTx(db, async () => {
    const now = Date.now();
    const old = await db.getFirstAsync<Record<EditableField, number>>(`SELECT ${field} FROM transactions WHERE id = ?`, id);
    if (!old) return;
    await db.runAsync(
      `UPDATE transactions SET ${field} = ?, ${field}_at = ?, reviewed = 1, reviewed_at = ?,
         updated_at = ?, updated_by = ?, synced = 0
       WHERE id = ?`,
      value, now, now, now, owner, id,
    );
    if (old[field] === value) return;
    await db.runAsync(
      `INSERT INTO edit_history (id, transaction_id, field, old_value, new_value, changed_at, changed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      newId(), id, field, String(old[field]), String(value), now, owner,
    );
  });
}

// Tích / bỏ tích "tiền bán hàng".
export const setSale = (db: SQLiteDatabase, id: string, isSale: boolean, owner: string) =>
  updateField(db, id, 'is_sale', isSale ? 1 : 0, owner);

// Xoá mềm (dùng cho khoản tiền mặt nhập nhầm).
export const softDelete = (db: SQLiteDatabase, id: string, owner: string) => updateField(db, id, 'deleted', 1, owner);

/**
 * Đánh dấu đã xem đúng các khoản đang hiển thị (`ids`). Khoản chưa tích vẫn là tiền cá nhân.
 * Không đụng các khoản mới về sau khi màn hình được vẽ, để không khoản nào bị coi là cá nhân mà chưa ai thấy.
 */
export function markReviewed(db: SQLiteDatabase, ids: string[], owner: string): Promise<void> {
  if (!ids.length) return Promise.resolve();
  return writeTx(db, async () => {
    const now = Date.now();
    await db.runAsync(
      `UPDATE transactions SET reviewed = 1, reviewed_at = ?, updated_at = ?, updated_by = ?, synced = 0
       WHERE reviewed = 0 AND id IN (${placeholders(ids.length)})`,
      now, now, owner, ...ids,
    );
  });
}
