import { placeholders } from './db';

/**
 * Bảng đồng bộ kiểu "bản sửa cuối thắng" theo nhóm trường: mỗi nhóm có 1 cột thời điểm sửa (`at`),
 * khi gộp thì nhóm nào có `at` mới hơn thì lấy cả nhóm. Khớp với trigger tương ứng trong supabase/schema.sql.
 */
export type LwwTable = {
  table: string;
  kvKey: string; // con trỏ kéo về trong kv
  fixed: readonly string[]; // cột không đổi sau khi tạo (ngoài id)
  groups: readonly { at: string; fields: readonly string[] }[];
};

// Cột có trên server (không có cột local `synced`).
export function lwwCols(t: LwwTable): string[] {
  return ['id', ...t.fixed, ...t.groups.flatMap((g) => g.fields), ...t.groups.map((g) => g.at), 'updated_at', 'updated_by'];
}

// Câu ghi 1 dòng kéo về: chỉ cập nhật khi có nhóm mới hơn → `changes` = số dòng thay đổi thật.
export function upsertPulledSql(t: LwwTable): string {
  const cols = lwwCols(t);
  const T = t.table;
  const sets = [
    ...t.groups.flatMap((g) =>
      g.fields.map((f) => `${f} = CASE WHEN excluded.${g.at} > ${T}.${g.at} THEN excluded.${f} ELSE ${T}.${f} END`),
    ),
    ...t.groups.map((g) => `${g.at} = MAX(excluded.${g.at}, ${T}.${g.at})`),
    `updated_by = CASE WHEN excluded.updated_at > ${T}.updated_at THEN excluded.updated_by ELSE ${T}.updated_by END`,
    `updated_at = MAX(excluded.updated_at, ${T}.updated_at)`,
  ];
  const newer = [...t.groups.map((g) => g.at), 'updated_at'].map((at) => `excluded.${at} > ${T}.${at}`).join(' OR ');
  return `INSERT INTO ${T} (${cols.join(', ')}, synced) VALUES (${placeholders(cols.length)}, 1)
    ON CONFLICT(id) DO UPDATE SET ${sets.join(',\n')}
    WHERE ${newer}`;
}

export const NOTE_CONTENT_COLS = ['kind', 'due_date', 'item', 'quantity', 'person', 'address', 'phone', 'note'] as const;

export const NOTES_TABLE: LwwTable = {
  table: 'notes',
  kvKey: 'last_pull_notes',
  fixed: [],
  groups: [
    { at: 'content_at', fields: NOTE_CONTENT_COLS },
    { at: 'done_at', fields: ['done'] },
    { at: 'deleted_at', fields: ['deleted'] },
  ],
};

export const PEOPLE_TABLE: LwwTable = {
  table: 'people',
  kvKey: 'last_pull_people',
  fixed: ['role'],
  groups: [
    { at: 'name_at', fields: ['name'] },
    { at: 'deleted_at', fields: ['deleted'] },
  ],
};

export const PURCHASE_CONTENT_COLS = ['category', 'date', 'item', 'quantity', 'amount', 'supplier', 'note'] as const;

export const PURCHASES_TABLE: LwwTable = {
  table: 'purchases',
  kvKey: 'last_pull_purchases',
  fixed: [],
  groups: [
    { at: 'content_at', fields: PURCHASE_CONTENT_COLS },
    { at: 'paid_at', fields: ['paid'] },
    { at: 'deleted_at', fields: ['deleted'] },
  ],
};

export const DAY_OFF_TABLE: LwwTable = {
  table: 'day_off',
  kvKey: 'last_pull_day_off',
  fixed: ['date', 'person_id'],
  groups: [{ at: 'part_at', fields: ['part'] }],
};
