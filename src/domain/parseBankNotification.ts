import { normalizeText, parseLocalDateTime, parseVnd } from './text';
import type { BankSource, ParsedBankTxn, RawBankNotification } from './types';

// Giữ khớp với BANK_PACKAGES trong modules/bank-notification-listener/.../BankNotificationService.kt
const BANK_PACKAGES: Record<string, BankSource> = {
  'com.mbmobile': 'MB',
  'com.vnpay.bidv': 'BIDV',
};

// "TK 03xxx789" hoặc "TK BIDV 1234xxx890"
const ACCOUNT_RE = /\bTK\s*(?:[A-Z]+\s+)?:?\s*([0-9xX*]{4,})/i;
const AMOUNT_RE = /([+-])\s*([\d.,]+)\s*VND/i;
const BALANCE_RE = /\b(?:SD|So du)\s*:?\s*([\d.,]+)\s*VND/i;
const DATE_RE = /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/;
const TIME_RE = /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/;
const DESC_RE = /\b(?:ND|Noi dung)\s*:?\s*([\s\S]*)$/i;

/**
 * Đọc thông báo biến động số dư MB / BIDV, theo từng trường riêng lẻ nên chịu được
 * thứ tự khác nhau giữa 2 ngân hàng (MB: ngày trước giờ, BIDV: giờ trước ngày).
 * Trả về null nếu không phải ngân hàng hỗ trợ hoặc không tìm thấy số tiền.
 */
export function parseBankNotification(n: RawBankNotification): ParsedBankTxn | null {
  const source = BANK_PACKAGES[n.packageName];
  if (!source) return null;

  const text = normalizeText(`${n.text}`);
  const amountMatch = text.match(AMOUNT_RE);
  if (!amountMatch) return null;

  const amount = parseVnd(amountMatch[2]) * (amountMatch[1] === '-' ? -1 : 1);
  if (!Number.isFinite(amount) || amount === 0) return null;

  const balanceMatch = text.match(BALANCE_RE);
  const balance = balanceMatch ? parseVnd(balanceMatch[1]) : NaN;

  const date = text.match(DATE_RE)?.[1];
  const time = text.match(TIME_RE)?.[1];
  const occurredAt = (date && time && parseLocalDateTime(date, time)) || n.postedAt;

  const description = (text.match(DESC_RE)?.[1] ?? '').replace(/[.\s]+$/, '').trim();

  return {
    source,
    account: text.match(ACCOUNT_RE)?.[1] ?? '',
    amount,
    balanceAfter: Number.isFinite(balance) ? balance : null,
    occurredAt,
    description,
  };
}

// Id xác định: cùng 1 giao dịch dù đến 2 lần hay từ 2 máy đều ra cùng id.
export function bankTxnId(t: ParsedBankTxn): string {
  return [t.source, t.account, t.occurredAt, t.amount, t.balanceAfter ?? ''].join('|');
}
