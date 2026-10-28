import { DAY_OFF_TABLE, lwwCols, NOTES_TABLE, PEOPLE_TABLE, upsertPulledSql } from '../lww';

describe('lwwCols', () => {
  it('id, cột cố định, các nhóm, thời điểm sửa', () => {
    expect(lwwCols(DAY_OFF_TABLE)).toEqual(['id', 'date', 'person_id', 'part', 'part_at', 'updated_at', 'updated_by']);
    expect(lwwCols(PEOPLE_TABLE)).toEqual(['id', 'role', 'name', 'deleted', 'name_at', 'deleted_at', 'updated_at', 'updated_by']);
  });
});

describe('upsertPulledSql', () => {
  const sql = upsertPulledSql(NOTES_TABLE).replace(/\s+/g, ' ');

  it('mỗi trường lấy theo thời điểm sửa của nhóm nó', () => {
    expect(sql).toContain('item = CASE WHEN excluded.content_at > notes.content_at THEN excluded.item ELSE notes.item END');
    expect(sql).toContain('done = CASE WHEN excluded.done_at > notes.done_at THEN excluded.done ELSE notes.done END');
    expect(sql).toContain('content_at = MAX(excluded.content_at, notes.content_at)');
  });

  it('chỉ cập nhật khi có nhóm mới hơn', () => {
    expect(sql).toContain(
      'WHERE excluded.content_at > notes.content_at OR excluded.done_at > notes.done_at OR excluded.deleted_at > notes.deleted_at OR excluded.updated_at > notes.updated_at',
    );
  });

  it('số dấu ? khớp số cột', () => {
    expect(sql.match(/\?/g)).toHaveLength(lwwCols(NOTES_TABLE).length);
  });
});
