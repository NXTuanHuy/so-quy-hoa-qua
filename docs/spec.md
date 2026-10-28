# Spec — Sổ Quỹ Hoa Quả (MVP)

Nguồn: [intent](intent/so-quy-hoa-qua.md) · [one-pager](ideas/so-quy-hoa-qua.md) · [ADR](adr/0001-kien-truc-mvp.md)

## 1. Mục tiêu
2 chủ cửa hàng hoa quả biết **tổng thu bán hàng** theo ngày / tuần / tháng / năm, **không sót khoản chuyển khoản**, không lẫn tiền cá nhân.

## 2. Chức năng & tiêu chí nghiệm thu

### F1. Ghi biến động số dư từ thông báo
- Đọc thông báo của app **MB Bank** (`com.mbmobile`) và **BIDV SmartBanking** (`com.vnpay.bidv`).
- Thông báo được lưu ở tầng native (file hàng đợi) ngay khi đến, kể cả khi app JS không chạy. Mở app → đọc hàng đợi → phân tích → lưu SQLite.
- Mỗi giao dịch có id xác định từ `ngân hàng + tài khoản + thời điểm + số tiền + số dư` → **không ghi trùng** khi cùng thông báo đến 2 lần hoặc 2 máy cùng nhận.
- Thông báo không phân tích được → lưu vào danh sách "chưa đọc được" để gửi mẫu cho dev.
- ✅ Nghiệm thu: test parser với mẫu MB/BIDV; thông báo trùng chỉ tạo 1 giao dịch.

### F2. Phân loại bán hàng / cá nhân
- Tiền vào mặc định **cá nhân** (`is_sale = 0`), `reviewed = 0`.
- Tiền ra: luôn cá nhân, `reviewed = 1` (không cần xem).
- Chủ tích "Bán hàng" → `is_sale = 1`, `reviewed = 1`. Bỏ tích → `is_sale = 0`.
- **Gợi ý theo người chuyển:** nếu tên người chuyển (trích từ nội dung) đã từng được tích bán hàng → giao dịch mới tự `is_sale = 1` nhưng vẫn `reviewed = 0` (chủ vẫn phải xem).
- Nút "Đã xem hết" → mọi khoản tiền vào hiện tại thành `reviewed = 1`.
- ✅ Nghiệm thu: màn hình chính hiển thị "Còn X khoản chưa xem".

### F3. Nhập nhanh tiền mặt bán hàng
- Nút "+ Tiền mặt" luôn có ở màn hình chính → bàn phím số to → "Lưu". Tối đa 2 lần chạm (ngoài các phím số).
- Tiền mặt: `source = CASH`, `is_sale = 1`, `reviewed = 1`.
- Có thể xoá (xoá mềm) khoản tiền mặt nhập nhầm.

### F4. Báo cáo doanh thu
- Kỳ: **ngày / tuần (thứ 2 → CN) / tháng / năm**, theo giờ máy.
- Mỗi kỳ: tổng bán hàng, tách chuyển khoản / tiền mặt, số khoản.
- Chỉ tính `is_sale = 1`, `amount > 0`, `deleted = 0`.

### F5. Cảnh báo lệch số dư
- Với mỗi tài khoản, xếp theo thời gian; với 2 giao dịch liền nhau có số dư: nếu `sd_trước + số_tiền ≠ sd_sau` → có khoản bị sót, số tiền thiếu = `sd_sau − số_tiền − sd_trước`, trong khoảng thời gian giữa 2 giao dịch.
- Hiển thị trên màn hình chính.

### F6. Đồng bộ 2 máy (Supabase)
- Offline-first: mọi thao tác ghi SQLite trước, `synced = 0`.
- Có mạng + đã đăng nhập → đẩy các dòng `synced = 0` lên, kéo các dòng mới về theo con trỏ `(server_updated_at, id)` (không sót dòng trùng timestamp).
- Xung đột: **bản sửa cuối thắng theo TỪNG trường** `is_sale` / `reviewed` / `deleted`, so bằng `*_at` của trường đó (cả ở client lẫn trigger trên server). Máy này bấm "Đã xem hết" không ghi đè cái tích "Bán hàng" của máy kia.
- "Đã xem hết" chỉ áp cho các khoản đang hiển thị, khoản về sau vẫn ở "Chưa xem".
- Mọi thao tác ghi SQLite chạy tuần tự trong 1 transaction qua `writeTx` để không có 2 transaction chồng nhau.
- Mỗi lần sửa ghi `edit_history` (ai, lúc nào, trường, cũ → mới), đồng bộ cùng.
- Bảo mật: 1 tài khoản Supabase dùng chung cho cửa hàng, RLS chỉ cho người đã đăng nhập; **tắt đăng ký** trên Supabase.

### F7. Ghi chú nhắc việc
- Tab "Ghi chú": loại **Giao bán** (hàng, số lượng, người mua, địa chỉ, SĐT, ghi chú) hoặc **Nhập hàng** (hàng, số lượng, nhập ở đâu…), theo ngày.
- Chạm SĐT để gọi. Nút "Đã xong" / "Chưa xong", "Sửa", "Xoá" (xoá mềm).
- **Không có thông báo hệ thống** (không cài expo-notifications): thẻ nhắc chỉ hiện ở màn Hôm nay, **từ 22:00 tối hôm trước đến 15:00 ngày đó**, việc chưa xong.
- Đồng bộ 2 máy qua bảng `notes`; bản sửa cuối thắng theo nhóm: nội dung (`content_at`) / đã xong (`done_at`) / đã xoá (`deleted_at`).
- ✅ Nghiệm thu: test khung nhắc (biên 21:59 / 22:00 / 14:59 / 15:00), việc xong/xoá không nhắc.

### F8. Lịch âm dương (tab "Lịch", gộp cả ghi chú)
- Lịch tháng: ngày dương + âm (thuật toán Hồ Ngọc Đức, múi giờ +7, tự tính offline), doanh thu gọn, chữ cái người đi làm, số việc.
- ★ đỏ: rằm / mùng 1. ★ vàng: 1 ngày trước rằm / mùng 1, ngày lễ (âm: Tết, Hàn thực, Giỗ Tổ, Đoan Ngọ, ông Táo…; dương: 1/1, 8/3, 30/4, 1/5, 2/9, 20/10). Lễ trùng rằm → đỏ.
- Chạm 1 ngày: âm lịch + năm can chi, doanh thu (sáng/chiều/tối + từng khoản), người làm + báo nghỉ, ghi chú của ngày.
- Màn Hôm nay nhắc trước 2 ngày khi sắp tới rằm / mùng 1 / ngày lễ.

### F9. Người làm: chủ + nhân viên
- Danh sách trong Cài đặt, 2 nhóm (bảng `people`, cột `role`, đồng bộ 2 máy, xoá mềm):
  - **Chủ** (`OWNER`): mặc định ngày nào cũng đi làm; báo nghỉ sáng / chiều / cả ngày.
  - **Nhân viên** (`STAFF`): mặc định không đi làm; ngày nào đi thì thêm (`part = 'WORK'`), có thể tạo nhân viên mới ngay trong chi tiết ngày.
- Trạng thái theo ngày ở bảng `day_off` (id = `ngày|người`, bản sửa cuối thắng theo `part_at`). Ai cũng sửa được cho mọi người.
- Lịch / Hôm nay chỉ hiện tên người đi làm; chủ nghỉ nửa ngày hiện kèm "(nghỉ sáng/chiều)". Hôm nay báo trước chủ nghỉ ngày mai.
- Chi tiết ngày chỉ hiện **tổng** doanh thu (chi tiết xem tab Báo cáo).

### F10. Sổ chi: tiền hàng + thuê nhà (chỉ tham khảo)
- Mỗi khoản chi: loại **Tiền hàng / Thuê nhà** (`category` GOODS/RENT), ngày, nội dung, số lượng (tiền hàng), thành tiền, trả cho ai, ghi chú, trả bằng **tiền mặt / chuyển khoản / còn nợ** (bảng `purchases`, đồng bộ 2 máy; nhóm LWW: nội dung `content_at`, trả tiền `paid_at`, xoá `deleted_at`).
- **Không trừ vào doanh thu.** Báo cáo mỗi kỳ hiện riêng "Đã chi (chỉ để tham khảo): Tiền hàng … · Thuê nhà …".
- Thêm từ nút "+ Nhập hàng" ở Hôm nay hoặc "+ Chi" trong chi tiết ngày. Ô lịch hiện 📦 tiền chi (màu xám).
- Thẻ "Còn nợ chưa trả" gộp theo người nhận, bấm "Đã trả" để chuyển sang tiền mặt / chuyển khoản.
- Khác với ghi chú loại "Nhập hàng" (F7): ghi chú là việc cần làm, sổ nhập hàng là lần nhập đã xảy ra.

## 3. Mô hình dữ liệu

`transactions`
| cột | kiểu | ghi chú |
|---|---|---|
| id | text PK | bank: id xác định; cash: ngẫu nhiên |
| source | text | `MB` / `BIDV` / `CASH` |
| account | text | số TK đã che, `''` với tiền mặt |
| amount | integer | VND, dương = vào, âm = ra |
| balance_after | integer null | số dư sau giao dịch |
| occurred_at | integer | epoch ms |
| description | text | nội dung chuyển khoản |
| counterparty | text null | tên người chuyển (trích từ nội dung) |
| is_sale | integer 0/1 | |
| reviewed | integer 0/1 | |
| deleted | integer 0/1 | xoá mềm |
| is_sale_at / reviewed_at / deleted_at | integer | epoch ms lần sửa cuối của từng trường, 0 = giá trị ban đầu |
| updated_at | integer | epoch ms lần sửa cuối của cả dòng |
| updated_by | text | tên chủ (cài đặt) |
| synced | integer 0/1 | chỉ ở local |

`edit_history`: id, transaction_id, field, old_value, new_value, changed_at, changed_by, synced (local).

`unparsed_notifications` (local): id, package_name, title, text, posted_at.

`kv` (local): tên chủ, mốc kéo dữ liệu lần cuối.

## 4. Định dạng thông báo (GIẢ ĐỊNH — cần mẫu thật)
- MB: `TK 03xxx789|GD: +200,000VND 18/05/26 09:12 |SD: 5,123,000VND|ND: NGUYEN VAN A chuyen tien`
- BIDV: `TK 1234xxx890 tai BIDV +500,000VND vao 09:30 12/03/2026. So du: 1,500,000VND. ND: ...` (có/không dấu tiếng Việt)

Parser phải chịu được: có dấu / không dấu, dấu phân cách `,` hoặc `.`, năm 2 hoặc 4 chữ số.

## 5. Cấu trúc thư mục
```
src/app/            # màn hình (Expo Router)
src/domain/         # logic thuần, có test: parser, đối soát, tổng hợp, người chuyển
src/data/           # SQLite, repository, đồng bộ Supabase
src/components/     # UI dùng lại
modules/bank-notification-listener/   # module native Kotlin
supabase/schema.sql # chạy 1 lần trên Supabase
```

## 6. Lệnh
```
npm test            # jest
npx tsc --noEmit    # typecheck
npx expo lint
npx expo prebuild   # sinh android/
npx eas-cli@latest build -p android --profile development
```

## 7. Ranh giới
- **Luôn:** logic nghiệp vụ ở `src/domain` là hàm thuần + có test.
- **Hỏi trước:** thay đổi URL/key Supabase, thêm package mới, thêm ngân hàng.
- **Không bao giờ:** gửi dữ liệu giao dịch tới nơi khác ngoài Supabase của cửa hàng; commit file `.env`.
