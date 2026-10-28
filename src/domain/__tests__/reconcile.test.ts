import { findBalanceGaps } from '../reconcile';

const row = (amount: number, balance: number | null, minute: number, account = '03xxx789') => ({
  source: 'MB' as const,
  account,
  amount,
  balance_after: balance,
  occurred_at: minute * 60_000,
});

describe('findBalanceGaps', () => {
  it('chuỗi khớp → không có khoản sót', () => {
    expect(findBalanceGaps([row(100, 1100, 1), row(50, 1150, 2), row(-20, 1130, 3)])).toEqual([]);
  });

  it('phát hiện khoản sót và số tiền thiếu', () => {
    const gaps = findBalanceGaps([row(100, 1100, 1), row(50, 1350, 5)]);
    expect(gaps).toEqual([
      { source: 'MB', account: '03xxx789', from: 60_000, to: 300_000, previousBalance: 1100, missingAmount: 200 },
    ]);
  });

  it('đảo thứ tự giao dịch cùng phút nếu như vậy chuỗi khớp', () => {
    expect(findBalanceGaps([row(100, 1100, 1), row(30, 1180, 2), row(50, 1150, 2)])).toEqual([]);
  });

  it('cộng dồn giao dịch không có số dư', () => {
    expect(findBalanceGaps([row(100, 1100, 1), row(40, null, 2), row(10, 1150, 3)])).toEqual([]);
  });

  it('tách riêng từng tài khoản, bỏ qua tiền mặt', () => {
    const rows = [
      row(100, 1100, 1, 'A'),
      row(100, 5100, 1, 'B'),
      row(10, 1110, 2, 'A'),
      row(10, 5110, 2, 'B'),
      { source: 'CASH' as const, account: '', amount: 999, balance_after: null, occurred_at: 0 },
    ];
    expect(findBalanceGaps(rows)).toEqual([]);
  });
});
