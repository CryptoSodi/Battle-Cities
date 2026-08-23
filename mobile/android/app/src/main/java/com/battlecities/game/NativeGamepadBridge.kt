package com.battlecities.game

import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import android.webkit.WebView
import org.json.JSONObject
import kotlin.math.abs

class NativeGamepadBridge(private val webView: WebView) {
    private var lastAxes = AxisState()

    fun handleKeyEvent(event: KeyEvent): Boolean {
        if (!isControllerSource(event.source)) {
            return false
        }

        val pressed = event.action == KeyEvent.ACTION_DOWN
        if (!pressed && event.action != KeyEvent.ACTION_UP) {
            return false
        }

        val control = androidButtonName(event.keyCode)
        dispatch(
            JSONObject()
                .put("type", "button")
                .put("control", control)
                .put("pressed", pressed)
                .put("keyCode", event.keyCode)
                .put("device", deviceJson(event.device))
        )
        return true
    }

    fun handleMotionEvent(event: MotionEvent): Boolean {
        if (
            event.action != MotionEvent.ACTION_MOVE ||
            event.source and InputDevice.SOURCE_JOYSTICK != InputDevice.SOURCE_JOYSTICK
        ) {
            return false
        }

        val axes = AxisState(
            leftX = centeredAxis(event, MotionEvent.AXIS_X),
            leftY = centeredAxis(event, MotionEvent.AXIS_Y),
            rightX = centeredAxis(event, MotionEvent.AXIS_Z),
            rightY = centeredAxis(event, MotionEvent.AXIS_RZ),
            hatX = centeredAxis(event, MotionEvent.AXIS_HAT_X),
            hatY = centeredAxis(event, MotionEvent.AXIS_HAT_Y),
            leftTrigger = triggerAxis(event, MotionEvent.AXIS_LTRIGGER, MotionEvent.AXIS_BRAKE),
            rightTrigger = triggerAxis(event, MotionEvent.AXIS_RTRIGGER, MotionEvent.AXIS_GAS)
        )

        if (axes.nearlyEquals(lastAxes)) {
            return true
        }
        lastAxes = axes

        dispatch(
            JSONObject()
                .put("type", "axes")
                .put("axes", axes.toJson())
                .put("device", deviceJson(event.device))
        )
        return true
    }

    fun reset() {
        lastAxes = AxisState()
        dispatch(JSONObject().put("type", "reset"))
    }

    private fun dispatch(detail: JSONObject) {
        val script =
            "window.dispatchEvent(new CustomEvent('battlecities:native-gamepad',{detail:" +
                detail.toString() +
                "}));"
        webView.post { webView.evaluateJavascript(script, null) }
    }

    private fun isControllerSource(source: Int): Boolean =
        source and InputDevice.SOURCE_GAMEPAD == InputDevice.SOURCE_GAMEPAD ||
            source and InputDevice.SOURCE_JOYSTICK == InputDevice.SOURCE_JOYSTICK ||
            source and InputDevice.SOURCE_DPAD == InputDevice.SOURCE_DPAD

    private fun androidButtonName(keyCode: Int): String =
        when (keyCode) {
            KeyEvent.KEYCODE_DPAD_UP -> "dpad_up"
            KeyEvent.KEYCODE_DPAD_DOWN -> "dpad_down"
            KeyEvent.KEYCODE_DPAD_LEFT -> "dpad_left"
            KeyEvent.KEYCODE_DPAD_RIGHT -> "dpad_right"
            KeyEvent.KEYCODE_DPAD_CENTER -> "dpad_center"
            KeyEvent.KEYCODE_BUTTON_A -> "button_a"
            KeyEvent.KEYCODE_BUTTON_B -> "button_b"
            KeyEvent.KEYCODE_BUTTON_X -> "button_x"
            KeyEvent.KEYCODE_BUTTON_Y -> "button_y"
            KeyEvent.KEYCODE_BUTTON_L1 -> "l1"
            KeyEvent.KEYCODE_BUTTON_R1 -> "r1"
            KeyEvent.KEYCODE_BUTTON_L2 -> "l2"
            KeyEvent.KEYCODE_BUTTON_R2 -> "r2"
            KeyEvent.KEYCODE_BUTTON_THUMBL -> "l3"
            KeyEvent.KEYCODE_BUTTON_THUMBR -> "r3"
            KeyEvent.KEYCODE_BUTTON_START -> "start"
            KeyEvent.KEYCODE_BUTTON_SELECT -> "select"
            KeyEvent.KEYCODE_BUTTON_MODE -> "mode"
            else -> "key_$keyCode"
        }

    private fun centeredAxis(event: MotionEvent, axis: Int): Float {
        val value = event.getAxisValue(axis)
        val flat = event.device?.getMotionRange(axis, event.source)?.flat ?: DEFAULT_AXIS_FLAT
        return if (abs(value) > flat) value else 0f
    }

    private fun triggerAxis(event: MotionEvent, primaryAxis: Int, fallbackAxis: Int): Float {
        val primary = event.getAxisValue(primaryAxis)
        return if (abs(primary) > DEFAULT_AXIS_FLAT) primary else event.getAxisValue(fallbackAxis)
    }

    private fun deviceJson(device: InputDevice?): JSONObject =
        JSONObject()
            .put("id", device?.id ?: -1)
            .put("name", device?.name ?: "Unknown controller")
            .put("vendorId", device?.vendorId ?: 0)
            .put("productId", device?.productId ?: 0)

    private data class AxisState(
        val leftX: Float = 0f,
        val leftY: Float = 0f,
        val rightX: Float = 0f,
        val rightY: Float = 0f,
        val hatX: Float = 0f,
        val hatY: Float = 0f,
        val leftTrigger: Float = 0f,
        val rightTrigger: Float = 0f
    ) {
        fun nearlyEquals(other: AxisState): Boolean =
            abs(leftX - other.leftX) < AXIS_EPSILON &&
                abs(leftY - other.leftY) < AXIS_EPSILON &&
                abs(rightX - other.rightX) < AXIS_EPSILON &&
                abs(rightY - other.rightY) < AXIS_EPSILON &&
                abs(hatX - other.hatX) < AXIS_EPSILON &&
                abs(hatY - other.hatY) < AXIS_EPSILON &&
                abs(leftTrigger - other.leftTrigger) < AXIS_EPSILON &&
                abs(rightTrigger - other.rightTrigger) < AXIS_EPSILON

        fun toJson(): JSONObject =
            JSONObject()
                .put("leftX", leftX.toDouble())
                .put("leftY", leftY.toDouble())
                .put("rightX", rightX.toDouble())
                .put("rightY", rightY.toDouble())
                .put("hatX", hatX.toDouble())
                .put("hatY", hatY.toDouble())
                .put("leftTrigger", leftTrigger.toDouble())
                .put("rightTrigger", rightTrigger.toDouble())
    }

    private companion object {
        const val DEFAULT_AXIS_FLAT = 0.15f
        const val AXIS_EPSILON = 0.01f
    }
}
