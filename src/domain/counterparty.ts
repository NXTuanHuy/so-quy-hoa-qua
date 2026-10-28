import { normalizeText } from './text';

const STOP_WORDS = new Set([
  'CHUYEN', 'CK', 'TRA', 'THANH', 'TT', 'GD', 'FT', 'TU', 'TOI', 'DEN', 'NOP',
  'MBVCB', 'IBFT', 'QR', 'NAPAS', 'MUA', 'TIEN', 'CT', 'BIDV', 'MB', 'VCB',
]);

/**
 * Đoán tên người chuyển từ nội dung chuyển khoản, ví dụ
 * "MBVCB.123456.NGUYEN VAN A chuyen tien" → "NGUYEN VAN A".
 * Chỉ dùng để gợi ý, nên trả null khi không chắc.
 */
export function extractCounterparty(description: string): string | null {
  const chunks = normalizeText(description).toUpperCase().split(/[^A-Z ]+/);
  for (const chunk of chunks) {
    const words: string[] = [];
    for (const word of chunk.trim().split(' ')) {
      if (!word) continue;
      if (STOP_WORDS.has(word)) break;
      words.push(word);
    }
    if (words.length >= 2 && words.length <= 5) return words.join(' ');
  }
  return null;
}
