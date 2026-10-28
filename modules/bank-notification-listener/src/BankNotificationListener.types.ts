export type BankNotificationListenerModuleEvents = {
  onNotification: () => void;
};

export type QueuedNotification = {
  packageName: string;
  title: string;
  text: string;
  postedAt: number;
};

// lineCount = số dòng thô đã đọc (gồm cả dòng hỏng), truyền nguyên vào ackQueue.
export type QueueSnapshot = {
  items: QueuedNotification[];
  lineCount: number;
};
