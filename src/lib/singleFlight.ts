/**
 * Bọc 1 hàm async để không chạy chồng: gọi trong lúc đang chạy thì ghi nhớ,
 * và chạy lại đúng 1 lần sau khi lượt hiện tại xong. Mọi lời gọi nhận chung promise của lượt đang chạy.
 */
export function singleFlight(fn: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null;
  let again = false;
  return () => {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      try {
        do {
          again = false;
          await fn();
        } while (again);
      } finally {
        running = null;
      }
    })();
    return running;
  };
}
