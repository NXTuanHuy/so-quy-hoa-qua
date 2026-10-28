/**
 * Đổi dương lịch → âm lịch Việt Nam (múi giờ +7), theo thuật toán của Hồ Ngọc Đức
 * (https://www.informatik.uni-leipzig.de/~duc/amlich/). Chạy offline, không cần thư viện.
 */
const TZ = 7;
const INT = Math.floor;

function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = INT((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  return jd;
}

function newMoonDay(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat =
    T < -11
      ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
      : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return INT(jd1 + C1 - deltat + 0.5 + TZ / 24);
}

function sunLongitude(jdn: number): number {
  const T = (jdn - 2451545.5 - TZ / 24) / 36525;
  const T2 = T * T;
  const dr = Math.PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L = L - Math.PI * 2 * INT(L / (Math.PI * 2));
  return INT((L / Math.PI) * 6);
}

function lunarMonth11(yy: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  const nm = newMoonDay(k);
  return sunLongitude(nm) >= 9 ? newMoonDay(k - 1) : nm;
}

function leapMonthOffset(a11: number): number {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let i = 1;
  let arc = sunLongitude(newMoonDay(k + i));
  let last: number;
  do {
    last = arc;
    i++;
    arc = sunLongitude(newMoonDay(k + i));
  } while (arc !== last && i < 14);
  return i - 1;
}

export type LunarDate = { day: number; month: number; year: number; leap: boolean };

// Ngày dương (theo giờ máy) → ngày âm.
export function toLunar(date: Date): LunarDate {
  const yy = date.getFullYear();
  const dayNumber = jdFromDate(date.getDate(), date.getMonth() + 1, yy);
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = newMoonDay(k + 1);
  if (monthStart > dayNumber) monthStart = newMoonDay(k);
  let a11 = lunarMonth11(yy);
  let b11 = a11;
  let year: number;
  if (a11 >= monthStart) {
    year = yy;
    a11 = lunarMonth11(yy - 1);
  } else {
    year = yy + 1;
    b11 = lunarMonth11(yy + 1);
  }
  const day = dayNumber - monthStart + 1;
  const diff = INT((monthStart - a11) / 29);
  let leap = false;
  let month = diff + 11;
  if (b11 - a11 > 365) {
    const leapDiff = leapMonthOffset(a11);
    if (diff >= leapDiff) {
      month = diff + 10;
      if (diff === leapDiff) leap = true;
    }
  }
  if (month > 12) month -= 12;
  if (month >= 11 && diff < 4) year -= 1;
  return { day, month, year, leap };
}

const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

// Tên năm âm lịch: 2026 → "Bính Ngọ".
export function canChiYear(lunarYear: number): string {
  return `${CAN[(lunarYear + 6) % 10]} ${CHI[(lunarYear + 8) % 12]}`;
}

// Lễ âm lịch (tháng không nhuận), "ngày/tháng".
const LUNAR_HOLIDAYS: Record<string, string> = {
  '1/1': 'Tết Nguyên Đán',
  '2/1': 'Mùng 2 Tết',
  '3/1': 'Mùng 3 Tết',
  '15/1': 'Rằm tháng Giêng',
  '3/3': 'Tết Hàn thực',
  '10/3': 'Giỗ Tổ Hùng Vương',
  '15/4': 'Lễ Phật đản',
  '5/5': 'Tết Đoan Ngọ',
  '15/7': 'Vu Lan',
  '15/8': 'Trung thu',
  '23/12': 'Ông Công ông Táo',
};

// Lễ dương lịch, "ngày/tháng".
const SOLAR_HOLIDAYS: Record<string, string> = {
  '1/1': 'Tết Dương lịch',
  '8/3': 'Quốc tế Phụ nữ',
  '30/4': 'Giải phóng miền Nam',
  '1/5': 'Quốc tế Lao động',
  '2/9': 'Quốc khánh',
  '20/10': 'Phụ nữ Việt Nam',
};

export type DayMark = {
  lunar: LunarDate;
  // 'red' = rằm / mùng 1; 'yellow' = trước rằm / mùng 1 1 ngày hoặc ngày lễ; null = ngày thường.
  star: 'red' | 'yellow' | null;
  // Tên dịp: "Rằm", "Mùng 1", "Trước rằm", "Trung thu"… (rỗng nếu ngày thường).
  labels: string[];
};

// Đánh dấu 1 ngày dương: rằm / mùng 1 (sao đỏ), trước 1 ngày hoặc ngày lễ (sao vàng).
export function markDay(date: Date): DayMark {
  const lunar = toLunar(date);
  const next = toLunar(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1));
  const labels: string[] = [];
  const holiday = lunar.leap ? undefined : LUNAR_HOLIDAYS[`${lunar.day}/${lunar.month}`];
  const solar = SOLAR_HOLIDAYS[`${date.getDate()}/${date.getMonth() + 1}`];
  if (holiday) labels.push(holiday);
  if (solar) labels.push(solar);

  const isFullOrNew = lunar.day === 1 || lunar.day === 15;
  if (isFullOrNew && !holiday) labels.push(lunar.day === 15 ? 'Rằm' : 'Mùng 1');
  const beforeFullOrNew = next.day === 1 || next.day === 15;
  if (beforeFullOrNew) labels.push(next.day === 15 ? 'Trước rằm' : 'Trước mùng 1');

  const star = isFullOrNew ? 'red' : beforeFullOrNew || labels.length > 0 ? 'yellow' : null;
  return { lunar, star, labels };
}

export type Occasion = { daysAway: number; date: Date; lunar: LunarDate; labels: string[] };

// Rằm / mùng 1 / ngày lễ trong `days` ngày tới (không tính hôm nay) — để nhắc nhập thêm hàng.
export function upcomingOccasions(now: Date, days: number): Occasion[] {
  const result: Occasion[] = [];
  for (let i = 1; i <= days; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const mark = markDay(date);
    const labels = mark.labels.filter((l) => !l.startsWith('Trước'));
    if (labels.length) result.push({ daysAway: i, date, lunar: mark.lunar, labels });
  }
  return result;
}
