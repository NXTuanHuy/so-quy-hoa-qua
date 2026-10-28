# Sổ Quỹ — thu bán hàng cho cửa hàng hoa quả

App Android (Expo) tự ghi biến động số dư **MB Bank** và **BIDV** từ thông báo, cho tích khoản nào là **tiền bán hàng**, nhập nhanh **tiền mặt**, báo cáo doanh thu **ngày / tuần / tháng / năm**, cảnh báo **khoản bị sót** qua số dư, đồng bộ 2 máy qua **Supabase**.

Tài liệu: [spec](docs/spec.md) · [ADR](docs/adr/0001-kien-truc-mvp.md) · [intent](docs/intent/so-quy-hoa-qua.md)

## Yêu cầu
- **Node ≥ 22.13** (Expo SDK 58 không chạy `expo start` trên Node 20)
- Tài khoản Expo (để build APK qua EAS) và Supabase (để đồng bộ)

## Cài đặt
```bash
npm install --legacy-peer-deps
npm test
npm run typecheck
```

### Supabase (1 lần)
1. Tạo project → SQL Editor → chạy [supabase/schema.sql](supabase/schema.sql)
2. Authentication → **tắt** "Allow new users to sign up" → Users → **Add user** (1 tài khoản dùng chung cho cửa hàng)
3. Copy `.env.example` → `.env`, điền URL + publishable key (Project Settings → API)

### Build APK để cài lên điện thoại
```bash
npx eas-cli@latest login
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://xxx.supabase.co --visibility plaintext
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_KEY --value sb_publishable_xxx --visibility plaintext
npx eas-cli@latest build -p android --profile preview
```
> `.env` không được upload lên EAS (nằm trong .gitignore), nên phải khai báo biến qua `eas env:create`.

Không chạy được trong **Expo Go** vì có module native đọc thông báo.

## Lần đầu mở app trên mỗi máy
1. Cài đặt → nhập **tên người dùng** (ghi vào lịch sử sửa)
2. **Mở cài đặt quyền** → bật Sổ Quỹ.
   Android 13+: nếu công tắc mờ → Cài đặt máy → Ứng dụng → Sổ Quỹ → ⋮ → *Cho phép cài đặt bị hạn chế*
3. Tắt **tối ưu pin** cho Sổ Quỹ (Xiaomi/Oppo: bật thêm *Tự khởi chạy*)
4. **Đăng nhập** tài khoản Supabase dùng chung

## Cấu trúc
```
src/app/          màn hình: Hôm nay, Giao dịch, Báo cáo, Cài đặt
src/domain/       logic thuần + test: đọc thông báo, đối soát số dư, tổng hợp
src/data/         SQLite, lịch sử sửa, đồng bộ Supabase, đọc hàng đợi native
modules/bank-notification-listener/   Kotlin: NotificationListenerService + hàng đợi file
supabase/schema.sql
```

## ⚠️ Cần làm trước khi dùng thật
Bộ đọc thông báo đang viết theo **mẫu giả định**. Cài app, để chạy 1–2 ngày, vào **Cài đặt → Thông báo chưa đọc được**, copy các mẫu (che số TK) để cập nhật regex trong `src/domain/parseBankNotification.ts` và test tương ứng.
