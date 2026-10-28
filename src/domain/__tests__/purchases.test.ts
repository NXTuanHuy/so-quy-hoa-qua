import { summarizeSales } from '../aggregate';
import { debtsBySupplier, expenseTotals, mergeReport } from '../purchases';
import type { ExpenseCategory, PaidBy, Purchase } from '../types';

const p = (
  date: string,
  amount: number,
  { supplier = '', paid = 'CASH', deleted = 0, category = 'GOODS' }: { supplier?: string; paid?: PaidBy; deleted?: number; category?: ExpenseCategory } = {},
): Purchase => ({
  id: `${date}-${amount}-${supplier}`,
  category,
  date,
  item: 'Xoài',
  quantity: '',
  amount,
  supplier,
  note: '',
  paid,
  deleted,
  content_at: 0,
  paid_at: 0,
  deleted_at: 0,
  updated_at: 0,
  updated_by: '',
});

describe('expenseTotals', () => {
  it('cộng theo kỳ và theo loại, bỏ dòng đã xoá', () => {
    const rows = [
      p('2026-10-27', 100_000),
      p('2026-10-27', 50_000),
      p('2026-10-28', 70_000),
      p('2026-10-01', 5_000_000, { category: 'RENT' }),
      p('2026-10-28', 9, { deleted: 1 }),
    ];
    expect(expenseTotals(rows, 'day').get(new Date(2026, 9, 27).getTime())).toEqual({ GOODS: 150_000, RENT: 0 });
    expect(expenseTotals(rows, 'month').get(new Date(2026, 9, 1).getTime())).toEqual({ GOODS: 220_000, RENT: 5_000_000 });
  });
});

describe('mergeReport', () => {
  it('kỳ chỉ có thu hoặc chỉ có chi đều hiện, không trừ chi vào thu', () => {
    const sales = summarizeSales(
      [{ source: 'MB' as const, amount: 300_000, occurred_at: new Date(2026, 9, 28, 9).getTime(), is_sale: 1, deleted: 0 }],
      'day',
    );
    const rows = mergeReport(sales, expenseTotals([p('2026-10-28', 100_000), p('2026-10-27', 40_000)], 'day'));
    expect(rows.map((r) => [r.start, r.sales?.total ?? 0, r.expense.GOODS])).toEqual([
      [new Date(2026, 9, 28).getTime(), 300_000, 100_000],
      [new Date(2026, 9, 27).getTime(), 0, 40_000],
    ]);
  });
});

describe('debtsBySupplier', () => {
  it('chỉ tính khoản còn nợ, gộp tên không phân biệt hoa thường, nợ nhiều trước', () => {
    const debts = debtsBySupplier([
      p('2026-10-27', 100_000, { supplier: 'Vựa chú Tư', paid: 'DEBT' }),
      p('2026-10-28', 50_000, { supplier: 'vựa chú tư ', paid: 'DEBT' }),
      p('2026-10-28', 500_000, { supplier: 'Chợ đầu mối', paid: 'DEBT' }),
      p('2026-10-28', 999_000, { supplier: 'Vựa chú Tư' }),
      p('2026-10-28', 1, { paid: 'DEBT', deleted: 1 }),
    ]);
    expect(debts.map((d) => [d.supplier, d.total, d.items.length])).toEqual([
      ['Chợ đầu mối', 500_000, 1],
      ['Vựa chú Tư', 150_000, 2],
    ]);
  });
});
