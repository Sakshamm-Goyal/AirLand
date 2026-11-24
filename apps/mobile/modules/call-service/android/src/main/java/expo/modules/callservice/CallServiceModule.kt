package expo.modules.callservice

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Starts/stops the ongoing-call foreground service so Android keeps mic, camera and the socket alive in the background. */
class CallServiceModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CallService")

    Function("start") { title: String, text: String, video: Boolean ->
      val ctx = appContext.reactContext ?: return@Function false
      // A microphone-type service may only start once RECORD_AUDIO is granted; otherwise Android throws.
      if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
        return@Function false
      }
      val intent = Intent(ctx, CallService::class.java)
        .putExtra("title", title)
        .putExtra("text", text)
        .putExtra("video", video)
      try {
        ContextCompat.startForegroundService(ctx, intent)
        true
      } catch (e: Exception) {
        false
      }
    }

    Function("stop") {
      val ctx = appContext.reactContext ?: return@Function false
      ctx.stopService(Intent(ctx, CallService::class.java))
    }
  }
}
