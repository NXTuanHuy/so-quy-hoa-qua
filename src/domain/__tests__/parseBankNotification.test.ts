import { bankTxnId, parseBankNotification } from '../parseBankNotification';

// Mẫu GIẢ ĐỊNH — thay bằng thông báo thật (đã che số TK) khi có.
const POSTED_AT = new Date(2026, 9, 27, 23, 0).getTime();

describe('parseBankNotification — MB', () => {
  const mb = (text: string) =>
    parseBankNotification({ packageName: 'com.mbmobile', title: 'Thông báo biến động số dư', text, postedAt: POSTED_AT });

  it('đọc tiền vào', () => {
    expect(mb('TK 03xxx789|GD: +200,000VND 18/05/26 09:12 |SD: 5,123,000VND|ND: NGUYEN VAN A chuyen tien')).toEqual({
      source: 'MB',
      account: '03xxx789',
      amount: 200000,
      balanceAfter: 5123000,
      occurredAt: new Date(2026, 4, 18, 9, 12).getTime(),
      description: 'NGUYEN VAN A chuyen tien',
    });
  });

  it('đọc tiền ra', () => {
    expect(mb('TK 03xxx789|GD: -1,500,000VND 18/05/26 10:00 |SD: 3,623,000VND|ND: tra tien hang')?.amount).toBe(-1500000);
  });
});

describe('parseBankNotification — BIDV', () => {
  const bidv = (text: string) =>
    parseBankNotification({ packageName: 'com.vnpay.bidv', title: 'BIDV', text, postedAt: POSTED_AT });

  it('đọc thông báo không dấu, giờ trước ngày', () => {
    expect(bidv('TK 1234xxx890 tai BIDV +500,000VND vao 09:30 12/03/2026. So du: 1,500,000VND. ND: TRAN THI B CK')).toEqual({
      source: 'BIDV',
      account: '1234xxx890',
      amount: 500000,
      balanceAfter: 1500000,
      occurredAt: new Date(2026, 2, 12, 9, 30).getTime(),
      description: 'TRAN THI B CK',
    });
  });

  it('đọc thông báo có dấu', () => {
    const r = bidv('Số dư TK BIDV 1234xxx890 +85.000VND vào 14:05 27/10/2026. Số dư: 1.585.000VND. Nội dung: mua cam');
    expect(r?.account).toBe('1234xxx890');
    expect(r?.amount).toBe(85000);
    expect(r?.balanceAfter).toBe(1585000);
    expect(r?.description).toBe('mua cam');
  });

  it('dùng thời điểm nhận thông báo khi không có ngày giờ, số dư null khi thiếu', () => {
    const r = bidv('TK 1234xxx890 +85,000VND');
    expect(r?.occurredAt).toBe(POSTED_AT);
    expect(r?.balanceAfter).toBeNull();
  });
});

describe('parseBankNotification — bỏ qua', () => {
  it('app khác', () => {
    expect(parseBankNotification({ packageName: 'com.zing.zalo', title: '', text: '+50,000VND', postedAt: 0 })).toBeNull();
  });
  it('thông báo quảng cáo không có số tiền', () => {
    expect(parseBankNotification({ packageName: 'com.mbmobile', title: '', text: 'Ưu đãi hoàn tiền 10%', postedAt: 0 })).toBeNull();
  });
});

describe('bankTxnId', () => {
  it('cùng giao dịch ra cùng id', () => {
    const text = 'TK 03xxx789|GD: +200,000VND 18/05/26 09:12 |SD: 5,123,000VND|ND: x';
    const a = parseBankNotification({ packageName: 'com.mbmobile', title: '', text, postedAt: 1 });
    const b = parseBankNotification({ packageName: 'com.mbmobile', title: '', text, postedAt: 2 });
    expect(a && b && bankTxnId(a)).toBe(b && bankTxnId(b));
  });
});
