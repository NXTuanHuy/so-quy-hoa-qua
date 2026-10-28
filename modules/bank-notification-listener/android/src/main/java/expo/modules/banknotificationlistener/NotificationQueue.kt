package expo.modules.banknotificationlistener

import android.content.Context
import org.json.JSONObject
import java.io.File

// Hàng đợi JSON-lines trong bộ nhớ app. JS đọc (read) rồi xác nhận (ack) sau khi đã lưu SQLite,
// nên nếu app chết giữa chừng thì lần sau đọc lại, không mất thông báo.
object NotificationQueue {
  private const val FILE_NAME = "bank_notifications.jsonl"

  private fun file(context: Context) = File(context.filesDir, FILE_NAME)

  @Synchronized
  fun append(context: Context, entry: JSONObject) {
    file(context).appendText(entry.toString() + "\n")
  }

  // Trả về { items, lineCount }: lineCount = số dòng thô đã đọc (kể cả dòng hỏng bị bỏ),
  // để ack() xoá đúng số dòng đó.
  @Synchronized
  fun read(context: Context): Map<String, Any> {
    val f = file(context)
    if (!f.exists()) return mapOf("items" to emptyList<Map<String, Any>>(), "lineCount" to 0)
    val lines = f.readLines().filter { it.isNotBlank() }
    val items = lines.mapNotNull { line ->
      try {
        val o = JSONObject(line)
        mapOf(
          "packageName" to o.optString("packageName"),
          "title" to o.optString("title"),
          "text" to o.optString("text"),
          "postedAt" to o.optLong("postedAt").toDouble(),
        )
      } catch (e: Exception) {
        null
      }
    }
    return mapOf("items" to items, "lineCount" to lines.size)
  }

  // Xoá `count` dòng đầu đã được JS lưu xong; dòng mới đến sau khi read() vẫn được giữ lại.
  @Synchronized
  fun ack(context: Context, count: Int) {
    val f = file(context)
    if (!f.exists()) return
    val remaining = f.readLines().filter { it.isNotBlank() }.drop(count)
    if (remaining.isEmpty()) f.delete() else f.writeText(remaining.joinToString("\n", postfix = "\n"))
  }
}
