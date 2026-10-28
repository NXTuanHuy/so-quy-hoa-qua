// Bỏ dấu tiếng Việt và gộp khoảng trắng, để regex không phụ thuộc thông báo có dấu hay không.
export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/\s+/g, ' ')
    .trim();
}

// "5,123,000" | "5.123.000" | "200,000.00" → 5123000 / 200000 (VND không có số lẻ).
export function parseVnd(raw: string): number {
  const withoutDecimals = raw.trim().replace(/[.,]\d{2}$/, '');
  const digits = withoutDecimals.replace(/\D/g, '');
  return digits ? Number(digits) : NaN;
}

// 1234000 → "1.234.000 đ"; số âm có dấu "-".
export function formatVnd(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const grouped = String(Math.abs(Math.round(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${grouped} đ`;
}

const pad = (n: number) => String(n).padStart(2, '0');

// Date → "27/10"
export function formatDayMonth(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

// epoch ms → "09:12 27/10" theo giờ máy.
export function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${formatDayMonth(d)}`;
}

// "18/05/26" + "09:12" → epoch ms theo giờ máy; null nếu không hợp lệ.
export function parseLocalDateTime(date: string, time: string): number | null {
  const d = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  const t = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!d || !t) return null;
  const year = d[3].length === 2 ? 2000 + Number(d[3]) : Number(d[3]);
  const month = Number(d[2]) - 1;
  const day = Number(d[1]);
  const value = new Date(year, month, day, Number(t[1]), Number(t[2]), Number(t[3] ?? 0));
  if (value.getMonth() !== month || value.getDate() !== day) return null;
  return value.getTime();
}
