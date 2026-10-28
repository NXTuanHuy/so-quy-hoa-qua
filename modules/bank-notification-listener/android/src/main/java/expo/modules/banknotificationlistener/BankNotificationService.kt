package expo.modules.banknotificationlistener

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject

// Nhận thông báo của app ngân hàng và ghi ngay vào hàng đợi file,
// để không mất dữ liệu khi phần JS của app không chạy.
class BankNotificationService : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification) {
    if (sbn.packageName !in BANK_PACKAGES) return
    val notification = sbn.notification ?: return
    if (notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return

    val extras = notification.extras
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
      ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString().orEmpty()
    if (text.isBlank()) return

    val entry = JSONObject()
      .put("packageName", sbn.packageName)
      .put("title", title)
      .put("text", text)
      .put("postedAt", sbn.postTime)
    NotificationQueue.append(applicationContext, entry)
    BankNotificationListenerModule.notifyNewEntry()
  }

  companion object {
    // Giữ khớp với BANK_PACKAGES trong src/domain/parseBankNotification.ts
    val BANK_PACKAGES = setOf("com.mbmobile", "com.vnpay.bidv")
  }
}
