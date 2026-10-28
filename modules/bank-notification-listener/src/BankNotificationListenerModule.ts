import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { BankNotificationListenerModuleEvents, QueueSnapshot } from './BankNotificationListener.types';

declare class BankNotificationListenerModule extends NativeModule<BankNotificationListenerModuleEvents> {
  isPermissionGranted(): boolean;
  openPermissionSettings(): void;
  readQueue(): Promise<QueueSnapshot>;
  ackQueue(count: number): Promise<void>;
}

// null khi chạy trong Expo Go / web (chưa có code native) → app vẫn mở được để xem UI.
export default requireOptionalNativeModule<BankNotificationListenerModule>('BankNotificationListener');
