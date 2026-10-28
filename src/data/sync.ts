import type { SupabaseClient } from '@supabase/supabase-js';
import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import type { EditHistory, Txn } from '@/domain/types';
import { afterCursor, shiftIso } from './cursor';
import { placeholders, writeTx } from './db';
import {
  DAY_OFF_TABLE,
  lwwCols,
  NOTES_TABLE,
  PEOPLE_TABLE,
  PURCHASES_TABLE,
  upsertPulledSql,
  type LwwTable,
} from './lww';
import { getKv, KV_UPSERT, setKv } from './repo';
import { supabase } from './supabase';

const PAGE = 500;
// Kéo lùi 5 phút để không lỡ dòng ghi cùng lúc trên server; dòng trùng được gộp lại vô hại.
const SAFETY_WINDOW_MS = 5 * 60_000;
const EPOCH = '1970-01-01T00:00:00Z';

// Cột có trên server (không có cột local `synced`).
const TXN_COLS = [
  'id', 'source', 'account', 'amount', 'balance_after', 'occurred_at', 'description', 'counterparty',
  'is_sale', 'reviewed', 'deleted', 'is_sale_at', 'reviewed_at', 'deleted_at', 'updated_at', 'updated_by',
] as const;
const HISTORY_COLS = ['id', 'transaction_id', 'field', 'old_value', 'new_value', 'changed_at', 'changed_by'] as const;
// Các bảng đồng bộ theo nhóm trường (ghi chú, người làm, báo nghỉ, nhập hàng).
const LWW_TABLES: readonly LwwTable[] = [NOTES_TABLE, PEOPLE_TABLE, DAY_OFF_TABLE, PURCHASES_TABLE];

type RemoteTxn = Txn & { server_updated_at: string };
type RemoteHistory = EditHistory & { server_created_at: string };
type LwwRow = { id: string; updated_at: number } & Record<string, SQLiteBindValue>;
type RemoteLwwRow = LwwRow & { server_updated_at: string };

export type SyncResult = { ok: true; pushed: number; pulled: number } | { ok: false; message: string };

// Gộp theo từng trường: trường nào có *_at mới hơn thì lấy giá trị đó (khớp trigger trên server).
const mergeField = (f: string) =>
  `${f} = CASE WHEN excluded.${f}_at > transactions.${f}_at THEN excluded.${f} ELSE transactions.${f} END,
   ${f}_at = MAX(excluded.${f}_at, transactions.${f}_at)`;

// Chỉ cập nhật khi bản kéo về thật sự mới hơn ở ít nhất 1 trường → `changes` = số dòng thay đổi thật.
const UPSERT_PULLED_TXN = `
  INSERT INTO transactions (${TXN_COLS.join(', ')}, synced)
  VALUES (${placeholders(TXN_COLS.length)}, 1)
  ON CONFLICT(id) DO UPDATE SET
    ${['is_sale', 'reviewed', 'deleted'].map(mergeField).join(',\n')},
    updated_by = CASE WHEN excluded.updated_at > transactions.updated_at THEN excluded.updated_by ELSE transactions.updated_by END,
    updated_at = MAX(excluded.updated_at, transactions.updated_at)
  WHERE excluded.is_sale_at > transactions.is_sale_at
     OR excluded.reviewed_at > transactions.reviewed_at
     OR excluded.deleted_at > transactions.deleted_at
     OR excluded.updated_at > transactions.updated_at`;

const INSERT_PULLED_HISTORY =`INSERT OR IGNORE INTO edit_history (${HISTORY_COLS.join(', ')}, synced)
  VALUES (${placeholders(HISTORY_COLS.length)}, 1)`;

/**
 * Kéo 1 bảng theo trang, con trỏ (cursorCol, id). Mỗi trang được ghi cùng con trỏ trong 1 writeTx.
 * `apply` ghi 1 dòng và trả về số dòng local thay đổi. Trả về tổng số dòng thay đổi, hoặc lỗi.
 */
async function pullPages<R extends { id: string }>(
  client: SupabaseClient,
  db: SQLiteDatabase,
  opts: { table: string; cursorCol: string; kvKey: string; cursorOf: (r: R) => string; apply: (r: R) => Promise<number> },
): Promise<{ changed: number } | { error: string }> {
  let ts = shiftIso((await getKv(db, opts.kvKey)) ?? EPOCH, SAFETY_WINDOW_MS);
  let lastId = '';
  let changed = 0;
  for (;;) {
    const { data, error } = await client
      .from(opts.table)
      .select('*')
      .or(afterCursor(opts.cursorCol, ts, lastId))
      .order(opts.cursorCol)
      .order('id')
      .limit(PAGE);
    if (error) return { error: error.message };
    // supabase-js chưa có kiểu sinh từ schema nên trả `any`; cột khớp supabase/schema.sql.
    const rows: R[] = data ?? [];
    const last = rows.at(-1);
    if (last) {
      ts = opts.cursorOf(last);
      lastId = last.id;
      const cursor = ts;
      changed += await writeTx(db, async () => {
        let n = 0;
        for (const r of rows) n += await opts.apply(r);
        await db.runAsync(KV_UPSERT, opts.kvKey, cursor);
        return n;
      });
    }
    if (rows.length < PAGE) return { changed };
  }
}

/**
 * Đồng bộ 2 chiều với Supabase. "Bản sửa cuối thắng" theo TỪNG trường (is_sale / reviewed / deleted),
 * nên máy này bấm "Đã xem hết" không ghi đè cái tích "Bán hàng" vừa làm ở máy kia.
 * Không giữ khoá ghi SQLite trong lúc gọi mạng. `pulled` = số dòng local thật sự thay đổi.
 */
export async function syncNow(db: SQLiteDatabase): Promise<SyncResult> {
  if (!supabase) return { ok: false, message: 'Chưa cấu hình Supabase (.env)' };
  const client = supabase;
  const { data: auth } = await client.auth.getSession();
  if (!auth.session) return { ok: false, message: 'Chưa đăng nhập đồng bộ' };

  // 1. Đẩy giao dịch đã sửa
  const dirty = await db.getAllAsync<Txn>(`SELECT ${TXN_COLS.join(', ')} FROM transactions WHERE synced = 0 LIMIT ?`, PAGE);
  if (dirty.length) {
    const { error } = await client.from('transactions').upsert(dirty, { onConflict: 'id' });
    if (error) return { ok: false, message: error.message };
    await writeTx(db, async () => {
      // Chỉ đánh dấu dòng không bị sửa thêm trong lúc đang đẩy.
      for (const r of dirty) {
        await db.runAsync('UPDATE transactions SET synced = 1 WHERE id = ? AND updated_at = ?', r.id, r.updated_at);
      }
    });
  }

  // 2. Đẩy lịch sử sửa (chỉ thêm)
  const hist = await db.getAllAsync<EditHistory>(`SELECT ${HISTORY_COLS.join(', ')} FROM edit_history WHERE synced = 0 LIMIT ?`, PAGE);
  if (hist.length) {
    const { error } = await client.from('edit_history').upsert(hist, { onConflict: 'id', ignoreDuplicates: true });
    if (error) return { ok: false, message: error.message };
    await writeTx(db, async () => {
      await db.runAsync(`UPDATE edit_history SET synced = 1 WHERE id IN (${placeholders(hist.length)})`, ...hist.map((h) => h.id));
    });
  }

  // 3. Đẩy ghi chú / người làm / báo nghỉ đã sửa
  let pushed = dirty.length;
  for (const t of LWW_TABLES) {
    const r = await pushLww(client, db, t);
    if ('error' in r) return { ok: false, message: r.error };
    pushed += r.pushed;
  }

  // 4. Kéo giao dịch, lịch sử sửa, rồi các bảng còn lại
  const txns = await pullPages<RemoteTxn>(client, db, {
    table: 'transactions',
    cursorCol: 'server_updated_at',
    kvKey: 'last_pull_txn',
    cursorOf: (r) => r.server_updated_at,
    apply: async (r) => (await db.runAsync(UPSERT_PULLED_TXN, ...TXN_COLS.map((c) => r[c]))).changes,
  });
  if ('error' in txns) return { ok: false, message: txns.error };

  const history = await pullPages<RemoteHistory>(client, db, {
    table: 'edit_history',
    cursorCol: 'server_created_at',
    kvKey: 'last_pull_history',
    cursorOf: (r) => r.server_created_at,
    apply: async (r) => (await db.runAsync(INSERT_PULLED_HISTORY, ...HISTORY_COLS.map((c) => r[c]))).changes,
  });
  if ('error' in history) return { ok: false, message: history.error };

  let pulled = txns.changed + history.changed;
  for (const t of LWW_TABLES) {
    const cols = lwwCols(t);
    const sql = upsertPulledSql(t);
    const r = await pullPages<RemoteLwwRow>(client, db, {
      table: t.table,
      cursorCol: 'server_updated_at',
      kvKey: t.kvKey,
      cursorOf: (row) => row.server_updated_at,
      apply: async (row) => (await db.runAsync(sql, ...cols.map((c) => row[c]))).changes,
    });
    if ('error' in r) return { ok: false, message: r.error };
    pulled += r.changed;
  }

  await setKv(db, 'last_sync_at', String(Date.now()));
  return { ok: true, pushed, pulled };
}

// Đẩy các dòng đã sửa (synced = 0) của 1 bảng LWW; chỉ đánh dấu dòng không bị sửa thêm trong lúc đẩy.
async function pushLww(client: SupabaseClient, db: SQLiteDatabase, t: LwwTable): Promise<{ pushed: number } | { error: string }> {
  const rows = await db.getAllAsync<LwwRow>(`SELECT ${lwwCols(t).join(', ')} FROM ${t.table} WHERE synced = 0 LIMIT ?`, PAGE);
  if (!rows.length) return { pushed: 0 };
  const { error } = await client.from(t.table).upsert(rows, { onConflict: 'id' });
  if (error) return { error: error.message };
  await writeTx(db, async () => {
    for (const r of rows) {
      await db.runAsync(`UPDATE ${t.table} SET synced = 1 WHERE id = ? AND updated_at = ?`, r.id, r.updated_at);
    }
  });
  return { pushed: rows.length };
}
