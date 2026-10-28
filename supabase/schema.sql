-- Chạy 1 lần trong Supabase → SQL Editor.
-- Sau đó: Authentication → Sign In / Providers → TẮT "Allow new users to sign up",
-- rồi Authentication → Users → "Add user" tạo 1 tài khoản dùng chung cho cửa hàng.

create table if not exists public.transactions (
  id text primary key,
  source text not null,
  account text not null default '',
  amount bigint not null,
  balance_after bigint,
  occurred_at bigint not null,
  description text not null default '',
  counterparty text,
  is_sale smallint not null default 0,
  reviewed smallint not null default 0,
  deleted smallint not null default 0,
  is_sale_at bigint not null default 0,
  reviewed_at bigint not null default 0,
  deleted_at bigint not null default 0,
  updated_at bigint not null,
  updated_by text not null default '',
  server_updated_at timestamptz not null default now()
);
-- Nếu đã chạy bản schema cũ trước đó:
alter table public.transactions add column if not exists is_sale_at bigint not null default 0;
alter table public.transactions add column if not exists reviewed_at bigint not null default 0;
alter table public.transactions add column if not exists deleted_at bigint not null default 0;
drop index if exists public.transactions_server_updated_at_idx;
create index if not exists transactions_pull_cursor_idx on public.transactions (server_updated_at, id);

create table if not exists public.edit_history (
  id text primary key,
  transaction_id text not null,
  field text not null,
  old_value text,
  new_value text,
  changed_at bigint not null,
  changed_by text not null,
  server_created_at timestamptz not null default now()
);
drop index if exists public.edit_history_server_created_at_idx;
create index if not exists edit_history_pull_cursor_idx on public.edit_history (server_created_at, id);

-- "Bản sửa cuối thắng" theo TỪNG trường: trường nào có *_at mới hơn thì lấy, còn lại giữ bản đang có.
-- Không có gì thay đổi → bỏ qua, để không đẩy server_updated_at lên vô ích.
create or replace function public.keep_newer_transaction() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.is_sale_at <= old.is_sale_at then
      new.is_sale := old.is_sale;
      new.is_sale_at := old.is_sale_at;
    end if;
    if new.reviewed_at <= old.reviewed_at then
      new.reviewed := old.reviewed;
      new.reviewed_at := old.reviewed_at;
    end if;
    if new.deleted_at <= old.deleted_at then
      new.deleted := old.deleted;
      new.deleted_at := old.deleted_at;
    end if;
    if new.updated_at <= old.updated_at then
      new.updated_at := old.updated_at;
      new.updated_by := old.updated_by;
    end if;
    if (new.is_sale, new.reviewed, new.deleted, new.is_sale_at, new.reviewed_at, new.deleted_at, new.updated_at)
       is not distinct from
       (old.is_sale, old.reviewed, old.deleted, old.is_sale_at, old.reviewed_at, old.deleted_at, old.updated_at) then
      return null;
    end if;
  end if;
  new.server_updated_at := now();
  return new;
end;
$$;

drop trigger if exists transactions_keep_newer on public.transactions;
create trigger transactions_keep_newer
  before insert or update on public.transactions
  for each row execute function public.keep_newer_transaction();

-- Chỉ tài khoản đã đăng nhập mới đọc/ghi được.
alter table public.transactions enable row level security;
alter table public.edit_history enable row level security;

drop policy if exists "shop read write" on public.transactions;
create policy "shop read write" on public.transactions
  for all to authenticated using (true) with check (true);

-- Lịch sử sửa: chỉ đọc và thêm, không sửa / xoá.
drop policy if exists "shop read history" on public.edit_history;
create policy "shop read history" on public.edit_history
  for select to authenticated using (true);
drop policy if exists "shop insert history" on public.edit_history;
create policy "shop insert history" on public.edit_history
  for insert to authenticated with check (true);

-- Ghi chú nhắc việc (nhập hàng / giao bán), đồng bộ 2 máy.
create table if not exists public.notes (
  id text primary key,
  kind text not null,
  due_date text not null,
  item text not null default '',
  quantity text not null default '',
  person text not null default '',
  address text not null default '',
  phone text not null default '',
  note text not null default '',
  done smallint not null default 0,
  deleted smallint not null default 0,
  content_at bigint not null default 0,
  done_at bigint not null default 0,
  deleted_at bigint not null default 0,
  updated_at bigint not null,
  updated_by text not null default '',
  server_updated_at timestamptz not null default now()
);
create index if not exists notes_pull_cursor_idx on public.notes (server_updated_at, id);

-- Bản sửa cuối thắng theo nhóm: nội dung (content_at) / đã xong (done_at) / đã xoá (deleted_at).
create or replace function public.keep_newer_note() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.content_at <= old.content_at then
      new.kind := old.kind; new.due_date := old.due_date; new.item := old.item; new.quantity := old.quantity;
      new.person := old.person; new.address := old.address; new.phone := old.phone; new.note := old.note;
      new.content_at := old.content_at;
    end if;
    if new.done_at <= old.done_at then
      new.done := old.done;
      new.done_at := old.done_at;
    end if;
    if new.deleted_at <= old.deleted_at then
      new.deleted := old.deleted;
      new.deleted_at := old.deleted_at;
    end if;
    if new.updated_at <= old.updated_at then
      new.updated_at := old.updated_at;
      new.updated_by := old.updated_by;
    end if;
    if (new.content_at, new.done_at, new.deleted_at, new.updated_at)
       is not distinct from (old.content_at, old.done_at, old.deleted_at, old.updated_at) then
      return null;
    end if;
  end if;
  new.server_updated_at := now();
  return new;
end;
$$;

drop trigger if exists notes_keep_newer on public.notes;
create trigger notes_keep_newer
  before insert or update on public.notes
  for each row execute function public.keep_newer_note();

alter table public.notes enable row level security;
drop policy if exists "shop notes" on public.notes;
create policy "shop notes" on public.notes
  for all to authenticated using (true) with check (true);

-- Người làm ở cửa hàng + báo nghỉ, đồng bộ 2 máy.
create table if not exists public.people (
  id text primary key,
  name text not null,
  deleted smallint not null default 0,
  name_at bigint not null default 0,
  deleted_at bigint not null default 0,
  updated_at bigint not null,
  updated_by text not null default '',
  server_updated_at timestamptz not null default now()
);
create index if not exists people_pull_cursor_idx on public.people (server_updated_at, id);
-- OWNER = chủ (mặc định đi làm, báo nghỉ), STAFF = nhân viên (chỉ đi làm ngày được thêm, day_off.part = 'WORK').
alter table public.people add column if not exists role text not null default 'OWNER';

-- id = 'YYYY-MM-DD|person_id' để 2 máy báo cùng ngày cùng người gộp về 1 dòng. part: NONE/AM/PM/FULL.
create table if not exists public.day_off (
  id text primary key,
  date text not null,
  person_id text not null,
  part text not null default 'NONE',
  part_at bigint not null default 0,
  updated_at bigint not null,
  updated_by text not null default '',
  server_updated_at timestamptz not null default now()
);
create index if not exists day_off_pull_cursor_idx on public.day_off (server_updated_at, id);

create or replace function public.keep_newer_person() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.name_at <= old.name_at then new.name := old.name; new.name_at := old.name_at; end if;
    if new.deleted_at <= old.deleted_at then new.deleted := old.deleted; new.deleted_at := old.deleted_at; end if;
    if new.updated_at <= old.updated_at then new.updated_at := old.updated_at; new.updated_by := old.updated_by; end if;
    if (new.name_at, new.deleted_at, new.updated_at) is not distinct from (old.name_at, old.deleted_at, old.updated_at) then
      return null;
    end if;
  end if;
  new.server_updated_at := now();
  return new;
end;
$$;

create or replace function public.keep_newer_day_off() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.part_at <= old.part_at then new.part := old.part; new.part_at := old.part_at; end if;
    if new.updated_at <= old.updated_at then new.updated_at := old.updated_at; new.updated_by := old.updated_by; end if;
    if (new.part_at, new.updated_at) is not distinct from (old.part_at, old.updated_at) then
      return null;
    end if;
  end if;
  new.server_updated_at := now();
  return new;
end;
$$;

drop trigger if exists people_keep_newer on public.people;
create trigger people_keep_newer before insert or update on public.people
  for each row execute function public.keep_newer_person();
drop trigger if exists day_off_keep_newer on public.day_off;
create trigger day_off_keep_newer before insert or update on public.day_off
  for each row execute function public.keep_newer_day_off();

alter table public.people enable row level security;
alter table public.day_off enable row level security;
drop policy if exists "shop people" on public.people;
create policy "shop people" on public.people for all to authenticated using (true) with check (true);
drop policy if exists "shop day off" on public.day_off;
create policy "shop day off" on public.day_off for all to authenticated using (true) with check (true);

-- Sổ nhập hàng theo ngày. paid: CASH / TRANSFER / DEBT (còn nợ).
create table if not exists public.purchases (
  id text primary key,
  date text not null,
  item text not null default '',
  quantity text not null default '',
  amount bigint not null default 0,
  supplier text not null default '',
  note text not null default '',
  paid text not null default 'CASH',
  deleted smallint not null default 0,
  content_at bigint not null default 0,
  paid_at bigint not null default 0,
  deleted_at bigint not null default 0,
  updated_at bigint not null,
  updated_by text not null default '',
  server_updated_at timestamptz not null default now()
);
create index if not exists purchases_pull_cursor_idx on public.purchases (server_updated_at, id);
-- Loại chi: GOODS = tiền hàng, RENT = thuê nhà (chỉ để tham khảo, không trừ vào doanh thu).
alter table public.purchases add column if not exists category text not null default 'GOODS';

create or replace function public.keep_newer_purchase() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.content_at <= old.content_at then
      new.category := old.category;
      new.date := old.date; new.item := old.item; new.quantity := old.quantity; new.amount := old.amount;
      new.supplier := old.supplier; new.note := old.note; new.content_at := old.content_at;
    end if;
    if new.paid_at <= old.paid_at then new.paid := old.paid; new.paid_at := old.paid_at; end if;
    if new.deleted_at <= old.deleted_at then new.deleted := old.deleted; new.deleted_at := old.deleted_at; end if;
    if new.updated_at <= old.updated_at then new.updated_at := old.updated_at; new.updated_by := old.updated_by; end if;
    if (new.content_at, new.paid_at, new.deleted_at, new.updated_at)
       is not distinct from (old.content_at, old.paid_at, old.deleted_at, old.updated_at) then
      return null;
    end if;
  end if;
  new.server_updated_at := now();
  return new;
end;
$$;

drop trigger if exists purchases_keep_newer on public.purchases;
create trigger purchases_keep_newer before insert or update on public.purchases
  for each row execute function public.keep_newer_purchase();

alter table public.purchases enable row level security;
drop policy if exists "shop purchases" on public.purchases;
create policy "shop purchases" on public.purchases for all to authenticated using (true) with check (true);
