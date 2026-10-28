import { extractCounterparty } from '../counterparty';

describe('extractCounterparty', () => {
  it.each([
    ['NGUYEN VAN A chuyen tien', 'NGUYEN VAN A'],
    ['MBVCB.1234567.NGUYEN VAN A chuyen tien', 'NGUYEN VAN A'],
    ['Trần Thị B CK', 'TRAN THI B'],
  ])('%s → %s', (desc, expected) => {
    expect(extractCounterparty(desc)).toBe(expected);
  });

  it.each(['CK mua hoa qua', '', '123456'])('không đoán khi không chắc: "%s"', (desc) => {
    expect(extractCounterparty(desc)).toBeNull();
  });
});
