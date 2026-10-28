import { useState } from 'react';
import { Text, View } from 'react-native';

import { DateStepper, Field, FormModal } from '@/components/FormParts';
import { Segmented } from '@/components/Segmented';
import type { PurchaseInput } from '@/data/purchases';
import { toDateKey } from '@/domain/notes';
import { formatVnd } from '@/domain/text';
import type { ExpenseCategory, PaidBy, Purchase } from '@/domain/types';
import { ui } from '@/ui/theme';

type Props = {
  // null = thêm mới.
  initial: Purchase | null;
  // Ngày mặc định khi thêm mới ("YYYY-MM-DD"); không truyền = hôm nay.
  defaultDate?: string;
  onClose: () => void;
  // Trả về true nếu đã lưu → đóng form.
  onSave: (input: PurchaseInput) => Promise<boolean>;
};

export const PAID_OPTIONS: { value: PaidBy; label: string }[] = [
  { value: 'CASH', label: 'Tiền mặt' },
  { value: 'TRANSFER', label: 'Chuyển khoản' },
  { value: 'DEBT', label: 'Còn nợ' },
];

// Chỉ giữ chữ số, tối đa 12 chữ số.
const digitsOnly = (s: string) => s.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12);

export const CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: 'GOODS', label: 'Tiền hàng' },
  { value: 'RENT', label: 'Thuê nhà' },
];

const RENT_ITEM = 'Tiền thuê nhà';

// Trạng thái form: số tiền giữ dạng chuỗi chữ số trong lúc gõ.
type FormState = Omit<PurchaseInput, 'amount'> & { amount: string };

// Form thêm / sửa 1 khoản chi: tiền nhập hàng hoặc tiền thuê nhà. Mặc định: tiền hàng, hôm nay, trả tiền mặt.
export function PurchaseFormModal({ initial, defaultDate, onClose, onSave }: Props) {
  const [now] = useState(() => Date.now());
  const today = toDateKey(new Date(now));
  const [form, setForm] = useState<FormState>(() => ({
    category: initial?.category ?? 'GOODS',
    date: initial?.date ?? defaultDate ?? today,
    item: initial?.item ?? '',
    quantity: initial?.quantity ?? '',
    amount: initial?.amount ? String(initial.amount) : '',
    supplier: initial?.supplier ?? '',
    note: initial?.note ?? '',
    paid: initial?.paid ?? 'CASH',
  }));
  const [saving, setSaving] = useState(false);
  const set = (key: 'date' | 'item' | 'quantity' | 'supplier' | 'note') => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  const amount = Number(form.amount || '0');
  const canSave = form.item.trim() !== '';
  const rent = form.category === 'RENT';

  // Đổi loại chi; chọn "Thuê nhà" khi chưa gõ nội dung thì điền sẵn "Tiền thuê nhà".
  const setCategory = (category: ExpenseCategory) =>
    setForm((f) => ({
      ...f,
      category,
      item: category === 'RENT' && !f.item.trim() ? RENT_ITEM : category === 'GOODS' && f.item === RENT_ITEM ? '' : f.item,
    }));

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const ok = await onSave({ ...form, amount });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <FormModal title={initial ? 'Sửa khoản chi' : 'Ghi khoản chi'} canSave={canSave} saving={saving} onClose={onClose} onSave={save}>
      <Segmented options={CATEGORY_OPTIONS} value={form.category} onChange={setCategory} />
      <DateStepper value={form.date} onChange={set('date')} today={today} now={now} />
      <View style={ui.card}>
        <Field
          label={rent ? 'Nội dung *' : 'Hàng gì *'}
          value={form.item}
          onChange={set('item')}
          placeholder={rent ? 'Ví dụ: Tiền thuê nhà tháng 10' : 'Ví dụ: Xoài cát'}
        />
        {!rent && <Field label="Số lượng" value={form.quantity} onChange={set('quantity')} placeholder="Ví dụ: 20 kg, 3 thùng" />}
        <Field
          label="Thành tiền (đồng)"
          value={form.amount}
          onChange={(v) => setForm((f) => ({ ...f, amount: digitsOnly(v) }))}
          placeholder="Ví dụ: 1200000"
          keyboardType="number-pad"
          hint={amount > 0 ? `= ${formatVnd(amount)}` : undefined}
        />
        <Field
          label={rent ? 'Trả cho ai' : 'Nhập của ai'}
          value={form.supplier}
          onChange={set('supplier')}
          placeholder={rent ? 'Ví dụ: Chủ nhà cô Hoa' : 'Ví dụ: Vựa chú Tư'}
        />
      </View>
      <Text style={[ui.h2, { marginHorizontal: 16, marginTop: 16 }]}>Trả tiền</Text>
      <Segmented options={PAID_OPTIONS} value={form.paid} onChange={(paid) => setForm((f) => ({ ...f, paid }))} />
      <View style={ui.card}>
        <Field label="Ghi chú" value={form.note} onChange={set('note')} placeholder="Nếu có" multiline />
      </View>
    </FormModal>
  );
}
