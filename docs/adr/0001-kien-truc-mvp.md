# ADR 0001 — Kiến trúc MVP

- **Trạng thái:** Đã chấp nhận
- **Ngày:** 2026-10-27

## Bối cảnh
App cần đọc thông báo ngân hàng trên Android, chạy offline, đồng bộ 2 máy. Dev là frontend (Vue/React), chưa có kinh nghiệm Kotlin.

## Quyết định
1. **Expo SDK 58 (React Native) + TypeScript**, chỉ Android, dùng development build (không chạy được trên Expo Go vì có module native).
2. **Đọc thông báo bằng local Expo module (Kotlin)** trong `modules/bank-notification-listener`:
   - `NotificationListenerService` lọc theo package MB/BIDV, ghi thông báo thô vào **file hàng đợi** (JSON lines) trong bộ nhớ app.
   - JS đọc hàng đợi khi mở app / khi nhận sự kiện → phân tích bằng TypeScript.
   - Lý do: không phụ thuộc Headless JS; thông báo không mất khi app JS bị tắt; logic phân tích viết bằng TS nên test được và dev sửa được.
3. **Lưu cục bộ bằng `expo-sqlite`**, nguồn sự thật trên máy.
4. **Đồng bộ qua Supabase** (`@supabase/supabase-js`), phiên đăng nhập lưu bằng `expo-sqlite/localStorage`.
   - Xung đột: bản sửa cuối thắng **theo từng trường** (`is_sale_at`, `reviewed_at`, `deleted_at`); trigger Postgres và lệnh upsert SQLite gộp cùng quy tắc.
     Lý do không dùng LWW cả dòng: máy B bấm "Đã xem hết" trên bản cũ sẽ ghi đè cái tích "Bán hàng" máy A vừa làm (phát hiện khi code review).
   - Kéo dữ liệu theo con trỏ `(server_updated_at, id)`: cả lô upsert dùng chung 1 `now()`, cắt trang theo timestamp đơn sẽ bỏ sót dòng.
   - Lịch sử sửa: bảng `edit_history` chỉ thêm, không sửa.
5. **Expo Router** cho điều hướng (theo khuyến nghị của template).

## Phương án đã loại
- **Kotlin native thuần:** ổn định tương đương nhưng dev phải học ngôn ngữ + UI framework mới.
- **Headless JS xử lý thông báo khi nền:** phức tạp, dễ bị hệ điều hành kill; hàng đợi file đơn giản hơn.
- **SePay/Casso:** có phí, giao quyền tài khoản cho bên thứ 3.
- **Anon key + RLS mở:** key nằm trong APK → ai có APK đều đọc được dữ liệu. Thay bằng 1 tài khoản đăng nhập dùng chung + tắt đăng ký.

## Hệ quả
- Phải build qua EAS hoặc Android Studio, không test bằng Expo Go.
- "Bản sửa cuối" phụ thuộc đồng hồ máy; lệch giờ lớn có thể làm sai thứ tự.
- Parser cần mẫu thông báo thật để xác nhận.
