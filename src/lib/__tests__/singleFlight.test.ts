import { singleFlight } from '../singleFlight';

describe('singleFlight', () => {
  it('gọi chồng nhau → chạy thêm đúng 1 lần, không chạy song song', async () => {
    let active = 0;
    let maxActive = 0;
    let runs = 0;
    const run = singleFlight(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      runs++;
      await new Promise((r) => setTimeout(r, 5));
      active--;
    });

    await Promise.all([run(), run(), run(), run()]);

    expect(maxActive).toBe(1);
    expect(runs).toBe(2);
  });

  it('chạy lại bình thường sau khi lượt trước xong, kể cả khi lượt trước lỗi', async () => {
    let runs = 0;
    const run = singleFlight(async () => {
      runs++;
      if (runs === 1) throw new Error('lỗi');
    });

    await expect(run()).rejects.toThrow('lỗi');
    await run();
    expect(runs).toBe(2);
  });
});
