import { useCallback, useState } from 'react';

import { useApp } from '@/state/AppContext';

// Kéo-để-làm-mới: gọi refresh của app (đọc thông báo + đồng bộ), bật/tắt vòng xoay.
export function usePullRefresh() {
  const { refresh } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);
  return { refreshing, onRefresh };
}
