import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { bankListener, ingestQueue } from '@/data/ingest';
import { getKv, setKv } from '@/data/repo';
import { syncNow } from '@/data/sync';
import { singleFlight } from '@/lib/singleFlight';
import { errorMessage, runSafely } from '@/ui/runSafely';

export type SyncStatus = { state: 'idle' | 'syncing' | 'ok' | 'error'; message: string };

type AppValue = {
  db: SQLiteDatabase;
  owner: string;
  setOwner: (name: string) => Promise<void>;
  // Tăng mỗi khi dữ liệu đổi → màn hình đọc lại.
  version: number;
  permissionGranted: boolean | null;
  sync: SyncStatus;
  // Đọc thông báo mới + đồng bộ + vẽ lại.
  refresh: () => Promise<void>;
  // Chạy 1 thao tác ghi với (db, tên chủ): lỗi thì báo, thành công thì vẽ lại + đồng bộ. Trả về true nếu thành công.
  mutate: (fn: (db: SQLiteDatabase, owner: string) => Promise<unknown>) => Promise<boolean>;
};

const AppContext = createContext<AppValue | null>(null);

const DEFAULT_OWNER = 'Chủ';

// Giữ trạng thái chung (db, tên chủ, phiên bản dữ liệu, đồng bộ) và tự đọc thông báo + đồng bộ
// khi mở app, khi quay lại app và khi có thông báo ngân hàng mới.
export function AppProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [owner, setOwnerState] = useState(DEFAULT_OWNER);
  const [version, setVersion] = useState(0);
  const [permissionGranted, setPermission] = useState<boolean | null>(null);
  const [sync, setSync] = useState<SyncStatus>({ state: 'idle', message: '' });

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  // Đồng bộ: không chạy chồng, có yêu cầu mới trong lúc chạy thì chạy lại 1 lần.
  const runSync = useMemo(
    () =>
      singleFlight(async () => {
        setSync({ state: 'syncing', message: 'Đang đồng bộ…' });
        try {
          const r = await syncNow(db);
          setSync(r.ok ? { state: 'ok', message: `Đã đồng bộ (↑${r.pushed} ↓${r.pulled})` } : { state: 'error', message: r.message });
          if (r.ok && r.pulled > 0) bump();
        } catch (e) {
          setSync({ state: 'error', message: `Không đồng bộ được: ${errorMessage(e)}` });
        }
      }),
    [db, bump],
  );

  // Đọc thông báo + đồng bộ, cùng cơ chế không chạy chồng (thông báo đến giữa chừng → chạy lại 1 lần).
  const refresh = useMemo(
    () =>
      singleFlight(async () => {
        try {
          // Đọc tên chủ từ kv mỗi lần để luôn đúng người, kể cả lần chạy đầu khi state chưa kịp nạp.
          const added = await ingestQueue(db, (await getKv(db, 'owner')) ?? DEFAULT_OWNER);
          if (added > 0) bump();
        } catch (e) {
          setSync({ state: 'error', message: `Lỗi đọc thông báo: ${errorMessage(e)}` });
        }
        // Kiểm tra lại quyền mỗi lần quay lại app (người dùng có thể vừa bật/tắt trong Cài đặt).
        setPermission(bankListener ? bankListener.isPermissionGranted() : false);
        await runSync();
      }),
    [db, bump, runSync],
  );

  const mutate = useCallback<AppValue['mutate']>(
    async (fn) => {
      const ok = await runSafely(() => fn(db, owner));
      if (ok) {
        bump();
        void runSync();
      }
      return ok;
    },
    [db, owner, bump, runSync],
  );

  const setOwner = useCallback(
    async (name: string) => {
      const value = name.trim() || DEFAULT_OWNER;
      await setKv(db, 'owner', value);
      setOwnerState(value);
    },
    [db],
  );

  useEffect(() => {
    getKv(db, 'owner').then((v) => {
      if (v) setOwnerState(v);
      void refresh();
    });
    const appSub = AppState.addEventListener('change', (s) => s === 'active' && void refresh());
    const notiSub = bankListener?.addListener('onNotification', () => void refresh());
    return () => {
      appSub.remove();
      notiSub?.remove();
    };
  }, [db, refresh]);

  const value = useMemo(
    () => ({ db, owner, setOwner, version, permissionGranted, sync, refresh, mutate }),
    [db, owner, setOwner, version, permissionGranted, sync, refresh, mutate],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Lấy trạng thái chung; chỉ dùng bên trong AppProvider.
export function useApp(): AppValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp phải nằm trong AppProvider');
  return ctx;
}
