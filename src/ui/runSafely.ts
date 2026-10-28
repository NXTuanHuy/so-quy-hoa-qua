import { Alert } from 'react-native';

// Lấy câu báo lỗi từ giá trị bị throw (Error hoặc bất kỳ).
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// Chạy 1 thao tác; nếu lỗi thì báo cho người dùng thay vì im lặng. Trả về true nếu thành công.
export async function runSafely(action: () => Promise<unknown>, title = 'Không lưu được'): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (e) {
    Alert.alert(title, errorMessage(e));
    return false;
  }
}
