package com.velqara.minecraft

import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val MINECRAFT_PACKAGE = "com.mojang.minecraftpe"

class MinecraftDetectorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MinecraftDetector")

    AsyncFunction("getMinecraftInfo") {
      val context = appContext.reactContext ?: return@AsyncFunction mapOf(
        "installed" to false,
        "packageName" to MINECRAFT_PACKAGE,
        "error" to "Android context unavailable"
      )
      try {
        val info = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          context.packageManager.getPackageInfo(
            MINECRAFT_PACKAGE,
            PackageManager.PackageInfoFlags.of(0)
          )
        } else {
          @Suppress("DEPRECATION")
          context.packageManager.getPackageInfo(MINECRAFT_PACKAGE, 0)
        }
        val versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          info.longVersionCode
        } else {
          @Suppress("DEPRECATION")
          info.versionCode.toLong()
        }
        mapOf(
          "installed" to true,
          "packageName" to MINECRAFT_PACKAGE,
          "versionName" to (info.versionName ?: ""),
          "versionCode" to versionCode
        )
      } catch (_: PackageManager.NameNotFoundException) {
        mapOf("installed" to false, "packageName" to MINECRAFT_PACKAGE)
      }
    }

    AsyncFunction("launchMinecraft") {
      val context = appContext.reactContext ?: return@AsyncFunction mapOf(
        "launched" to false,
        "reason" to "Android context unavailable"
      )
      val launchIntent: Intent? = context.packageManager.getLaunchIntentForPackage(MINECRAFT_PACKAGE)
      if (launchIntent == null) {
        return@AsyncFunction mapOf("launched" to false, "reason" to "Minecraft package not installed")
      }
      launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(launchIntent)
      mapOf("launched" to true, "packageName" to MINECRAFT_PACKAGE)
    }
  }
}
