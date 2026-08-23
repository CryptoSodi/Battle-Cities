package com.battlecities.game

import android.os.Build
import android.provider.Settings
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "AndroidDevice")
class AndroidDevicePlugin : Plugin() {
    @PluginMethod
    fun getInfo(call: PluginCall) {
        val androidId = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID
        ) ?: ""

        val response = JSObject()
        response.put("deviceId", androidId)
        response.put("manufacturer", Build.MANUFACTURER.orEmpty())
        response.put("brand", Build.BRAND.orEmpty())
        response.put("model", Build.MODEL.orEmpty())
        response.put("device", Build.DEVICE.orEmpty())
        response.put("product", Build.PRODUCT.orEmpty())
        response.put("osRelease", Build.VERSION.RELEASE.orEmpty())
        response.put("sdkVersion", Build.VERSION.SDK_INT)
        call.resolve(response)
    }
}
