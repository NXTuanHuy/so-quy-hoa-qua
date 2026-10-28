import type { Txn } from './types';

export type BalanceGap = {
  source: Txn['source'];
  account: string;
  from: number;
  to: number;
  previousBalance: number;
  missingAmount: number;
};

type Row = Pick<Txn, 'source' | 'account' | 'amount' | 'balance_after' | 'occurred_at'>;

/**
 * Tìm chỗ sót giao dịch: với mỗi tài khoản, số dư trước + số tiền phải bằng số dư sau.
 * Giao dịch không có số dư thì cộng dồn vào lần so sánh kế tiếp.
 * Giao dịch cùng thời điểm (cùng phút) được đảo thứ tự nếu cách đó làm chuỗi khớp.
 */
export function findBalanceGaps(rows: Row[]): BalanceGap[] {
  const byAccount = new Map<string, Row[]>();
  for (const r of rows) {
    if (r.source === 'CASH') continue;
    const key = `${r.source}|${r.account}`;
    const list = byAccount.get(key);
    if (list) list.push(r);
    else byAccount.set(key, [r]);
  }

  const gaps: BalanceGap[] = [];
  for (const list of byAccount.values()) {
    list.sort((a, b) => a.occurred_at - b.occurred_at);
    let prevBalance: number | null = null;
    let prevAt = 0;
    let pending = 0;

    for (let i = 0; i < list.length; i++) {
      if (list[i].balance_after === null) {
        pending += list[i].amount;
        continue;
      }
      const before = prevBalance === null ? null : prevBalance + pending;
      if (before !== null) {
        const fits = (r: Row) => before + r.amount === r.balance_after;
        // Không khớp → thử đổi chỗ với 1 giao dịch cùng thời điểm phía sau (danh sách đã sắp nên chúng nằm liền nhau).
        for (let k = i + 1; !fits(list[i]) && k < list.length && list[k].occurred_at === list[i].occurred_at; k++) {
          if (fits(list[k])) [list[i], list[k]] = [list[k], list[i]];
        }
      }
      // Dòng ở vị trí i luôn có số dư (dòng được đổi vào cũng "fits" nên có số dư).
      const cur = list[i];
      if (cur.balance_after === null) continue;
      const missing = before === null ? 0 : cur.balance_after - cur.amount - before;
      if (before !== null && missing !== 0) {
        gaps.push({
          source: cur.source,
          account: cur.account,
          from: prevAt,
          to: cur.occurred_at,
          previousBalance: before,
          missingAmount: missing,
        });
      }
      prevBalance = cur.balance_after;
      prevAt = cur.occurred_at;
      pending = 0;
    }
  }
  return gaps.sort((a, b) => b.to - a.to);
}
