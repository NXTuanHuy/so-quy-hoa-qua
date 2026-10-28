import type { SQLiteDatabase } from 'expo-sqlite';

export const DB_NAME = 'soquy.db';

let writeChain: Promise<unknown> = Promise.resolve();

/**
 * Mọi lệnh ghi SQLite đi qua đây: chạy LẦN LƯỢT (không 2 transaction chồng nhau trên cùng kết nối)
 * và trong 1 transaction (cả lô 1 lần commit, lỗi thì rollback cả lô).
 * Không gọi writeTx lồng bên trong writeTx — sẽ treo.
 */
export function writeTx<T>(db: SQLiteDatabase, fn: () => Promise<T>): Promise<T> {
  const task = async () => {
    const result: T[] = [];
    await db.withTransactionAsync(async () => {
      result.push(await fn());
    });
    return result[0];
  };
  const run = writeChain.then(task, task);
  writeChain = run.catch(() => undefined);
  return run;
}

// "?, ?, ?" cho n tham số SQL.
export const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(', ');

// Tạo / nâng cấp bảng theo user_version; mỗi bước chỉ chạy 1 lần.
export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version < 1) await migrateV1(db);
  if (version < 2) await migrateV2(db);
  if (version < 3) await migrateV3(db);
  if (version < 4) await migrateV4(db);
  if (version < 5) await migrateV5(db);
  if (version < 6) await migrateV6(db);
}

// v6: loại chi (tiền hàng / thuê nhà). Dòng cũ là tiền hàng.
async function migrateV6(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    ALTER TABLE purchases ADD COLUMN category TEXT NOT NULL DEFAULT 'GOODS';
    PRAGMA user_version = 6;
  `);
}

// v5: sổ nhập hàng theo ngày.
async function migrateV5(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      item TEXT NOT NULL DEFAULT '',
      quantity TEXT NOT NULL DEFAULT '',
      amount INTEGER NOT NULL DEFAULT 0,
      supplier TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      paid TEXT NOT NULL DEFAULT 'CASH',
      deleted INTEGER NOT NULL DEFAULT 0,
      content_at INTEGER NOT NULL DEFAULT 0,
      paid_at INTEGER NOT NULL DEFAULT 0,
      deleted_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      updated_by TEXT NOT NULL DEFAULT '',
      synced INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases (date);
    PRAGMA user_version = 5;
  `);
}

// v4: phân biệt chủ (mặc định đi làm) và nhân viên (thêm theo ngày). Người đã có trước đó là chủ.
async function migrateV4(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    ALTER TABLE people ADD COLUMN role TEXT NOT NULL DEFAULT 'OWNER';
    PRAGMA user_version = 4;
  `);
}

// v3: danh sách người làm + báo nghỉ.
async function migrateV3(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      name_at INTEGER NOT NULL DEFAULT 0,
      deleted_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      updated_by TEXT NOT NULL DEFAULT '',
      synced INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS day_off (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      person_id TEXT NOT NULL,
      part TEXT NOT NULL DEFAULT 'NONE',
      part_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      updated_by TEXT NOT NULL DEFAULT '',
      synced INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_day_off_date ON day_off (date);
    PRAGMA user_version = 3;
  `);
}

// v2: ghi chú nhắc việc (nhập hàng / giao bán).
async function migrateV2(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY NOT NULL,
      kind TEXT NOT NULL,
      due_date TEXT NOT NULL,
      item TEXT NOT NULL DEFAULT '',
      quantity TEXT NOT NULL DEFAULT '',
      person TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      done INTEGER NOT NULL DEFAULT 0,
      deleted INTEGER NOT NULL DEFAULT 0,
      content_at INTEGER NOT NULL DEFAULT 0,
      done_at INTEGER NOT NULL DEFAULT 0,
      deleted_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      updated_by TEXT NOT NULL DEFAULT '',
      synced INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_notes_due ON notes (due_date);
    CREATE INDEX IF NOT EXISTS idx_notes_synced ON notes (synced);
    PRAGMA user_version = 2;
  `);
}

// v1: giao dịch, lịch sử sửa, thông báo chưa đọc được, kv.
async function migrateV1(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = 'wal';
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY NOT NULL,
      source TEXT NOT NULL,
      account TEXT NOT NULL DEFAULT '',
      amount INTEGER NOT NULL,
      balance_after INTEGER,
      occurred_at INTEGER NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      counterparty TEXT,
      is_sale INTEGER NOT NULL DEFAULT 0,
      reviewed INTEGER NOT NULL DEFAULT 0,
      deleted INTEGER NOT NULL DEFAULT 0,
      is_sale_at INTEGER NOT NULL DEFAULT 0,
      reviewed_at INTEGER NOT NULL DEFAULT 0,
      deleted_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      updated_by TEXT NOT NULL DEFAULT '',
      synced INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_txn_time ON transactions (occurred_at);
    CREATE INDEX IF NOT EXISTS idx_txn_synced ON transactions (synced);
    CREATE INDEX IF NOT EXISTS idx_txn_sale_counterparty ON transactions (counterparty) WHERE is_sale = 1;
    CREATE TABLE IF NOT EXISTS edit_history (
      id TEXT PRIMARY KEY NOT NULL,
      transaction_id TEXT NOT NULL,
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_at INTEGER NOT NULL,
      changed_by TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_history_txn ON edit_history (transaction_id);
    CREATE TABLE IF NOT EXISTS unparsed_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_name TEXT NOT NULL,
      title TEXT NOT NULL,
      text TEXT NOT NULL,
      posted_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    PRAGMA user_version = 1;
  `);
}
