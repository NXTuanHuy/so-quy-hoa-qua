import { useEffect, useState, type DependencyList } from 'react';

import { errorMessage } from '@/ui/runSafely';

export type AsyncState<T> = { loading: boolean; error: string | null; data: T | null };

// Chạy hàm async khi deps đổi, trả về loading / error / data.
// loading = chưa có dữ liệu lẫn lỗi (lần tải đầu); các lần sau giữ dữ liệu cũ cho tới khi có dữ liệu mới.
// Bỏ kết quả cũ nếu deps đổi giữa chừng.
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<{ error: string | null; data: T | null }>({ error: null, data: null });

  useEffect(() => {
    let alive = true;
    fn()
      .then((data) => alive && setState({ error: null, data }))
      .catch((e: unknown) => alive && setState({ error: errorMessage(e), data: null }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, loading: state.data === null && state.error === null };
}
