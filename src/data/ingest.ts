import type { SQLiteDatabase } from 'expo-sqlite';

import BankListener from '../../modules/bank-notification-listener/src/BankNotificationListenerModule';
import { parseBankNotification } from '@/domain/parseBankNotification';
import { normalizeText } from '@/domain/text';
import type { ParsedBankTxn, RawBankNotification } from '@/domain/types';
import { insertBankTxns, insertUnparsed } from './repo';

// Module native; null khi chạy trong Expo Go / web.
export const bankListener = BankListener;

/**
 * Đọc hàng đợi thông báo từ native → phân tích → lưu SQLite → xác nhận đã lưu.
 * Trả về số giao dịch mới. Không tự chống gọi chồng — người gọi bọc bằng singleFlight.
 */
export async function ingestQueue(db: SQLiteDatabase, owner: string): Promise<number> {
  if (!BankListener) return 0;
  const { items, lineCount } = await BankListener.readQueue();
  if (!lineCount) return 0;
  const parsed: ParsedBankTxn[] = [];
  const unparsed: RawBankNotification[] = [];
  for (const n of items) {
    const p = parseBankNotification(n);
    if (p) parsed.push(p);
    // Chỉ giữ thông báo trông giống biến động số dư, bỏ quảng cáo.
    else if (/VND|so du|\bSD\b/i.test(normalizeText(n.text))) unparsed.push(n);
  }
  const inserted = await insertBankTxns(db, parsed, owner);
  await insertUnparsed(db, unparsed);
  // Xác nhận đúng số dòng thô đã đọc (kể cả dòng hỏng) để không đọc lại / xoá nhầm dòng.
  await BankListener.ackQueue(lineCount);
  return inserted;
}
