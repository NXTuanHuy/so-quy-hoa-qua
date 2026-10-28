package expo.modules.banknotificationlistener

import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BankNotificationListenerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BankNotificationListener")

    Events("onNotification")

    OnCreate { instance = this@BankNotificationListenerModule }
    OnDestroy { if (instance === this@BankNotificationListenerModule) instance = null }

    Function("isPermissionGranted") {
      val enabled = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners").orEmpty()
      enabled.contains(context.packageName)
    }

    Function("openPermissionSettings") {
      context.startActivity(
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
    }

    AsyncFunction("readQueue") { NotificationQueue.read(context) }

    AsyncFunction("ackQueue") { count: Int -> NotificationQueue.ack(context, count) }
  }

  private val context
    get() = requireNotNull(appContext.reactContext)

  companion object {
    @Volatile
    private var instance: BankNotificationListenerModule? = null

    // Báo cho JS (nếu đang chạy) rằng hàng đợi có thông báo mới.
    fun notifyNewEntry() {
      instance?.sendEvent("onNotification")
    }
  }
}
