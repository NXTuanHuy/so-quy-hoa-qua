# Sổ Quỹ Hoa Quả

> Cập nhật 2026-10-27 theo [statement of intent](../intent/so-quy-hoa-qua.md).

## Problem Statement
Làm sao để 2 chủ một cửa hàng hoa quả **không sót khoản chuyển khoản nào** và biết **tổng thu bán hàng** theo ngày / tuần / tháng / năm, khi tài khoản ngân hàng lẫn tiền cá nhân — kể cả khi không có mạng?

## Recommended Direction
**Đọc thông báo + đối soát số dư.**

App Android (Expo) đọc thông báo "biến động số dư" của app ngân hàng trên cả 2 máy, lưu cục bộ, đồng bộ qua Supabase khi có mạng.
Mỗi thông báo có số dư → dùng để **phát hiện giao dịch bị sót** (số dư trước + số tiền ≠ số dư sau).
Mặc định mọi khoản là tiền cá nhân; chủ tích chọn khoản nào là tiền bán hàng. Tiền mặt bán hàng nhập tay.

## Quyết định đã chốt
| Vấn đề | Quyết định |
|---|---|
| Người dùng | Cửa hàng hoa quả nhỏ, 2 chủ quyền ngang nhau |
| Nền tảng | Expo (React Native), chỉ Android, development build |
| Ngân hàng làm trước | MB Bank, BIDV |
| Đồng bộ | Supabase |
| Xung đột khi 2 người sửa | Lấy bản sửa cuối, lưu lịch sử sửa (ai, lúc nào, cũ → mới) |
| Phân loại | **Mặc định cá nhân**, tích chọn để chuyển sang tiền bán hàng; nhớ người chuyển để gợi ý |
| Tiền mặt | Nhập từng khoản, nút nhập nhanh trên màn hình chính, tối đa 2 lần chạm |
| Tiêu chí thành công | Không sót khoản chuyển khoản |

## Key Assumptions to Validate
- [ ] Thông báo MB và BIDV có **số tiền + số dư + nội dung** → thu thập 2–3 thông báo thật mỗi ngân hàng (che số TK)
- [ ] Quyền đọc thông báo chạy nền ổn định trên 2 máy thật → chạy thử 3–5 ngày
- [ ] Chủ shop chịu xem và tích các khoản mỗi ngày → dùng thử 1 tuần, đếm số khoản "chưa xem" tồn
- [ ] Tiền mặt được nhập đều → so tổng tiền mặt trong app với tiền trong két cuối ngày
- [ ] Đồng hồ 2 máy đủ chính xác để "bản sửa cuối" đúng thứ tự

## MVP Scope
- APK Android, offline-first
- Đọc thông báo MB Bank + BIDV
- Danh sách biến động, tích "bán hàng", nhắc "còn X khoản chưa xem", gợi ý theo người chuyển
- Nút nhập nhanh tiền mặt bán hàng
- Báo cáo tổng thu bán hàng ngày / tuần / tháng / năm (tách chuyển khoản / tiền mặt)
- Cảnh báo lệch số dư
- Đồng bộ 2 máy qua Supabase, bản sửa cuối thắng + lịch sử sửa

## Not Doing (and Why)
- **Chi phí, lãi/lỗ** — mục đích MVP chỉ là doanh thu; để giai đoạn 2
- **Ghi đơn bán, ghép đơn ↔ giao dịch** — chủ shop không ghi đơn
- **Đọc SMS** — Google Play hạn chế, nhiều ngân hàng đã bỏ SMS
- **SePay/Casso** — có phí, giao quyền truy cập tài khoản cho bên thứ 3
- **iOS** — iOS không cho đọc thông báo app khác
- **Vietcombank, Techcombank, VietinBank, Agribank** — thêm sau, mỗi ngân hàng cần bộ đọc riêng
- **Tồn kho, loa báo tiền** — để sau
- **Phân quyền phức tạp** — 2 chủ ngang quyền
- **Đưa lên Google Play** — Play duyệt quyền đọc thông báo rất khắt khe
