import { useState } from 'react';
import { View } from 'react-native';

import { DateStepper, Field, FormModal, shiftDay } from '@/components/FormParts';
import { Segmented } from '@/components/Segmented';
import type { NoteInput } from '@/data/notes';
import { toDateKey } from '@/domain/notes';
import type { Note, NoteKind } from '@/domain/types';
import { ui } from '@/ui/theme';

type Props = {
  // null = thêm mới.
  initial: Note | null;
  // Ngày mặc định khi thêm mới ("YYYY-MM-DD"); không truyền = ngày mai.
  defaultDate?: string;
  onClose: () => void;
  // Trả về true nếu đã lưu → đóng form.
  onSave: (input: NoteInput) => Promise<boolean>;
};

const KINDS: { value: NoteKind; label: string }[] = [
  { value: 'DELIVERY', label: 'Giao bán' },
  { value: 'IMPORT', label: 'Nhập hàng' },
];

// Form thêm / sửa ghi chú nhắc việc. Mặc định: giao bán, ngày mai.
export function NoteFormModal({ initial, defaultDate, onClose, onSave }: Props) {
  // Mốc "hôm nay" lấy 1 lần khi mở form.
  const [now] = useState(() => Date.now());
  const today = toDateKey(new Date(now));
  const [form, setForm] = useState<NoteInput>(() => ({
    kind: initial?.kind ?? 'DELIVERY',
    due_date: initial?.due_date ?? defaultDate ?? shiftDay(today, 1),
    item: initial?.item ?? '',
    quantity: initial?.quantity ?? '',
    person: initial?.person ?? '',
    address: initial?.address ?? '',
    phone: initial?.phone ?? '',
    note: initial?.note ?? '',
  }));
  const [saving, setSaving] = useState(false);
  const set = (key: keyof NoteInput) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const canSave = form.item.trim() !== '';

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const ok = await onSave(form);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <FormModal title={initial ? 'Sửa ghi chú' : 'Thêm ghi chú'} canSave={canSave} saving={saving} onClose={onClose} onSave={save}>
      <Segmented options={KINDS} value={form.kind} onChange={(kind) => setForm((f) => ({ ...f, kind }))} />
      <DateStepper value={form.due_date} onChange={set('due_date')} today={today} now={now} />
      <View style={ui.card}>
        <Field label="Hàng gì *" value={form.item} onChange={set('item')} placeholder="Ví dụ: Xoài cát" />
        <Field label="Số lượng" value={form.quantity} onChange={set('quantity')} placeholder="Ví dụ: 20 kg" />
        <Field
          label={form.kind === 'DELIVERY' ? 'Người mua' : 'Nhập ở đâu / của ai'}
          value={form.person}
          onChange={set('person')}
          placeholder={form.kind === 'DELIVERY' ? 'Ví dụ: Cô Lan' : 'Ví dụ: Vựa chú Tư'}
        />
        <Field label="Địa chỉ" value={form.address} onChange={set('address')} placeholder="Nếu có" />
        <Field label="Số điện thoại" value={form.phone} onChange={set('phone')} placeholder="Nếu có" keyboardType="phone-pad" />
        <Field label="Ghi chú thêm" value={form.note} onChange={set('note')} placeholder="Nếu có" multiline />
      </View>
    </FormModal>
  );
}
