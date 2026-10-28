import { periodStart, type SalesSummary } from './aggregate';
import { fromDateKey } from './notes';
import type { ExpenseCategory, Period, Purchase } from './types';

type ExpenseInput = Pick<Purchase, 'date' | 'amount' | 'deleted' | 'category'>;

// Tổng chi theo loại trong 1 kỳ (chỉ để tham khảo, không trừ vào doanh thu).
export type ExpenseTotals = Record<ExpenseCategory, number>;

const emptyTotals = (): ExpenseTotals => ({ GOODS: 0, RENT: 0 });

// Tổng chi theo kỳ: mốc bắt đầu kỳ (epoch ms) → tiền hàng / thuê nhà. Bỏ dòng đã xoá.
export function expenseTotals(rows: ExpenseInput[], period: Period): Map<number, ExpenseTotals> {
  const totals = new Map<number, ExpenseTotals>();
  for (const r of rows) {
    if (r.deleted === 1) continue;
    const key = periodStart(fromDateKey(r.date).getTime(), period).getTime();
    const t = totals.get(key) ?? emptyTotals();
    t[r.category] += r.amount;
    totals.set(key, t);
  }
  return totals;
}

export type ReportRow<T extends SalesSummary> = { start: number; sales: T | null; expense: ExpenseTotals };

// Gộp thu bán hàng và chi (tham khảo) theo kỳ: kỳ nào có 1 trong 2 đều hiện, mới nhất trước.
export function mergeReport<T extends SalesSummary>(sales: T[], expenses: Map<number, ExpenseTotals>): ReportRow<T>[] {
  const byStart = new Map(sales.map((s) => [s.start, s]));
  const starts = new Set([...byStart.keys(), ...expenses.keys()]);
  return [...starts]
    .sort((a, b) => b - a)
    .map((start) => ({ start, sales: byStart.get(start) ?? null, expense: expenses.get(start) ?? emptyTotals() }));
}

export type Debt = { supplier: string; total: number; items: Purchase[] };

// Các khoản còn nợ, gộp theo người nhận tiền (tên không phân biệt hoa thường), nợ nhiều nhất trước.
export function debtsBySupplier(rows: Purchase[]): Debt[] {
  const map = new Map<string, Debt>();
  for (const r of rows) {
    if (r.deleted === 1 || r.paid !== 'DEBT') continue;
    const name = r.supplier.trim() || 'Không rõ';
    const key = name.toLowerCase();
    const d = map.get(key) ?? { supplier: name, total: 0, items: [] };
    d.total += r.amount;
    d.items.push(r);
    map.set(key, d);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}
