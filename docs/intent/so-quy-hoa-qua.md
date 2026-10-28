# Statement of Intent — Sổ Quỹ Hoa Quả

> Đã được xác nhận "đúng" bởi người dùng ngày 2026-10-27.

- **Mục đích:** đánh dấu biến động số dư nào là **tiền bán hàng**, rồi tổng hợp **tổng thu bán hàng** theo ngày / tuần / tháng / năm.
- **Người dùng:** 2 chủ cửa hàng hoa quả nhỏ, quyền ngang nhau, mỗi người 1 máy Android, tài khoản ngân hàng lẫn tiền cá nhân.
- **Thành công:** không sót khoản chuyển khoản nào; doanh thu không lẫn tiền cá nhân.
- **Cách dùng hằng ngày:**
  - App tự ghi biến động số dư MB + BIDV từ thông báo, **mặc định là cá nhân**, chủ **tích chọn** khoản nào là tiền bán hàng.
  - Nhắc **"còn X khoản chưa xem"**; **nhớ người chuyển** để tự gợi ý tích.
  - Tiền mặt bán hàng nhập từng khoản bằng nút nhập nhanh, tối đa 2 lần chạm.
  - Số dư không khớp → cảnh báo có khoản bị sót.
- **Ràng buộc:** Expo (React Native) cho Android, chạy offline, đồng bộ Supabase, xung đột lấy bản sửa cuối + lưu lịch sử sửa.
- **Không làm trong MVP:** chi phí, lãi/lỗ, ghi đơn bán, tồn kho, loa báo tiền, SMS, iOS, ngân hàng ngoài MB/BIDV, SePay/Casso, Google Play.
