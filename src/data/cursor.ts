// Bọc giá trị trong dấu nháy kép cho bộ lọc PostgREST (giá trị có : . , ( ) | …).
function quote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Bộ lọc `.or()` lấy các dòng đứng SAU con trỏ (ts, id) khi sắp theo (column, id):
 * column > ts  HOẶC  (column = ts VÀ id > lastId).
 * Không bỏ sót dòng trùng timestamp nằm vắt qua ranh giới trang.
 */
export function afterCursor(column: string, ts: string, lastId: string): string {
  return `${column}.gt.${quote(ts)},and(${column}.eq.${quote(ts)},id.gt.${quote(lastId)})`;
}

// Lùi mốc thời gian ISO đi `ms` mili-giây.
export function shiftIso(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() - ms).toISOString();
}
