export type BankSource = 'MB' | 'BIDV';
export type TxnSource = BankSource | 'CASH';

// Thông báo thô do module native đưa lên.
export type RawBankNotification = {
  packageName: string;
  title: string;
  text: string;
  postedAt: number;
};

// Kết quả phân tích 1 thông báo biến động số dư.
export type ParsedBankTxn = {
  source: BankSource;
  account: string;
  amount: number;
  balanceAfter: number | null;
  occurredAt: number;
  description: string;
};

export type Txn = {
  id: string;
  source: TxnSource;
  account: string;
  amount: number;
  balance_after: number | null;
  occurred_at: number;
  description: string;
  counterparty: string | null;
  is_sale: number;
  reviewed: number;
  deleted: number;
  // Thời điểm sửa từng trường (epoch ms, 0 = giá trị ban đầu) — dùng để gộp "bản sửa cuối thắng" theo từng trường.
  is_sale_at: number;
  reviewed_at: number;
  deleted_at: number;
  updated_at: number;
  updated_by: string;
};

export type EditHistory = {
  id: string;
  transaction_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: number;
  changed_by: string;
};

export type Period = 'day' | 'week' | 'month' | 'year';

// OWNER = chủ: mặc định ngày nào cũng đi làm, có thể báo nghỉ. STAFF = nhân viên: chỉ đi làm ngày được thêm.
export type PersonRole = 'OWNER' | 'STAFF';

// Người làm ở cửa hàng (danh sách trong Cài đặt, đồng bộ 2 máy).
export type Person = {
  id: string;
  name: string;
  role: PersonRole;
  deleted: number;
  name_at: number;
  deleted_at: number;
  updated_at: number;
  updated_by: string;
};

// Trạng thái 1 người trong 1 ngày.
// Chủ: NONE = đi làm (mặc định), AM = nghỉ sáng, PM = nghỉ chiều, FULL = nghỉ cả ngày.
// Nhân viên: WORK = có đi làm hôm đó, NONE = không (mặc định).
export type DayPart = 'NONE' | 'AM' | 'PM' | 'FULL' | 'WORK';

export type DayOff = {
  id: string; // `${date}|${person_id}` — 2 máy báo cùng ngày cùng người gộp về 1 dòng
  date: string; // "YYYY-MM-DD"
  person_id: string;
  part: DayPart;
  part_at: number;
  updated_at: number;
  updated_by: string;
};

// Cách trả tiền nhập hàng: tiền mặt / chuyển khoản / còn nợ nhà cung cấp.
export type PaidBy = 'CASH' | 'TRANSFER' | 'DEBT';

// Loại chi: tiền nhập hàng / tiền thuê nhà. Chỉ để tham khảo, không trừ vào doanh thu.
export type ExpenseCategory = 'GOODS' | 'RENT';

// 1 khoản chi (nhập hàng hoặc thuê nhà).
export type Purchase = {
  id: string;
  category: ExpenseCategory;
  date: string; // "YYYY-MM-DD"
  item: string;
  quantity: string; // tự do: "20 kg", "3 thùng"
  amount: number; // VND
  supplier: string; // nhập của ai
  note: string;
  paid: PaidBy;
  deleted: number;
  content_at: number;
  paid_at: number;
  deleted_at: number;
  updated_at: number;
  updated_by: string;
};

// Ghi chú nhắc việc: nhập hàng (từ đâu) hoặc giao bán (cho ai).
export type NoteKind = 'IMPORT' | 'DELIVERY';

export type Note = {
  id: string;
  kind: NoteKind;
  due_date: string; // "YYYY-MM-DD" theo giờ máy
  item: string;
  quantity: string;
  person: string; // nơi nhập hoặc người mua
  address: string;
  phone: string;
  note: string;
  done: number;
  deleted: number;
  // Bản sửa cuối thắng theo nhóm: nội dung / đã xong / đã xoá.
  content_at: number;
  done_at: number;
  deleted_at: number;
  updated_at: number;
  updated_by: string;
};
