import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

// Chiều cao bàn phím đang mở (0 khi đóng). Cộng vào khoảng trống cuối ScrollView để cuộn được ô nhập lên trên bàn phím.
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}
