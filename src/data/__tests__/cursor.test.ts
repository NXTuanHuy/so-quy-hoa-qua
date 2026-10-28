import { afterCursor, shiftIso } from '../cursor';

describe('afterCursor', () => {
  it('lấy dòng sau (ts, id), có nháy kép cho giá trị chứa ký tự đặc biệt', () => {
    expect(afterCursor('server_updated_at', '2026-10-27T10:00:00.123456+00:00', 'MB|03xxx|1|2|3')).toBe(
      'server_updated_at.gt."2026-10-27T10:00:00.123456+00:00",' +
        'and(server_updated_at.eq."2026-10-27T10:00:00.123456+00:00",id.gt."MB|03xxx|1|2|3")',
    );
  });

  it('thoát dấu nháy và gạch chéo trong giá trị', () => {
    expect(afterCursor('c', 't', 'a"b\\c')).toBe('c.gt."t",and(c.eq."t",id.gt."a\\"b\\\\c")');
  });
});

describe('shiftIso', () => {
  it('lùi đúng số mili-giây', () => {
    expect(shiftIso('2026-10-27T10:05:00.000Z', 5 * 60_000)).toBe('2026-10-27T10:00:00.000Z');
  });
});
