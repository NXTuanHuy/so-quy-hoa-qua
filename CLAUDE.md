@AGENTS.md

## Project: Sổ Quỹ (thu bán hàng cửa hàng hoa quả)

- Spec: `docs/spec.md` · ADR: `docs/adr/` · intent: `docs/intent/`
- Chỉ Android. Expo SDK 58, TypeScript strict, Expo Router (`src/app/`), alias `@/` → `src/`.
- Logic nghiệp vụ là hàm thuần trong `src/domain/`, luôn kèm test trong `src/domain/__tests__/`.
- Đọc thông báo: module local `modules/bank-notification-listener` (Kotlin) ghi hàng đợi file → `src/data/ingest.ts` đọc/ack.
- Lưu trữ: `expo-sqlite` (`src/data/db.ts` migrate theo `PRAGMA user_version`). Đồng bộ: `src/data/sync.ts` + `supabase/schema.sql`, bản sửa cuối thắng theo từng trường (`*_at`), con trỏ pull `(server_updated_at, id)`, `edit_history` chỉ thêm.
- Mọi lệnh ghi SQLite đi qua `writeTx` (`src/data/db.ts`, = khoá tuần tự + transaction); không gọi `writeTx` lồng trong `writeTx` (sẽ treo). Thao tác ghi từ UI đi qua `mutate` của AppContext.
- Tiền: số nguyên VND, dương = vào, âm = ra. Thời gian: epoch ms.
- Cài package: `npx expo install <pkg> -- --legacy-peer-deps` (xung đột peer `react-dom` có sẵn từ expo-router).
- Trước khi xong: `npm test`, `npm run typecheck`, `npx eslint .` (`expo lint` cần Node ≥ 22.13).
- Không tự sửa `.env`, URL/key Supabase; hỏi trước khi thêm ngân hàng hoặc package mới.
