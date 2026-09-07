package com.battlecities.game;

import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BattleCitiesHaptics")
public class BattleCitiesHapticsPlugin extends Plugin {
    private static final long MAX_DURATION_MS = 10_000L;

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("supported", getVibrator().hasVibrator());
        call.resolve(result);
    }

    @PluginMethod
    public void impact(PluginCall call) {
        String style = call.getString("style", "medium");
        long duration = 32L;
        int amplitude = 150;

        if ("light".equals(style)) {
            duration = 18L;
            amplitude = 90;
        } else if ("heavy".equals(style)) {
            duration = 55L;
            amplitude = 255;
        }

        vibrate(duration, amplitude);
        call.resolve();
    }

    @PluginMethod
    public void vibrate(PluginCall call) {
        long duration = Math.max(1L, Math.min(MAX_DURATION_MS, call.getLong("duration", 40L)));
        int amplitude = Math.max(1, Math.min(255, call.getInt("amplitude", 180)));
        vibrate(duration, amplitude);
        call.resolve();
    }

    @PluginMethod
    public void playPattern(PluginCall call) {
        JSArray values = call.getArray("pattern");
        if (values == null || values.length() == 0) {
            call.reject("A non-empty vibration pattern is required.");
            return;
        }

        long[] pattern = new long[values.length()];
        for (int index = 0; index < values.length(); index++) {
            pattern[index] = Math.max(0L, Math.min(MAX_DURATION_MS, values.optLong(index, 0L)));
        }

        Vibrator vibrator = getVibrator();
        if (vibrator.hasVibrator()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
            } else {
                vibrator.vibrate(pattern, -1);
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        getVibrator().cancel();
        call.resolve();
    }

    private void vibrate(long duration, int amplitude) {
        Vibrator vibrator = getVibrator();
        if (!vibrator.hasVibrator()) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(duration, amplitude));
        } else {
            vibrator.vibrate(duration);
        }
    }

    @SuppressWarnings("deprecation")
    private Vibrator getVibrator() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager = (VibratorManager) getContext().getSystemService(
                Context.VIBRATOR_MANAGER_SERVICE
            );
            return manager.getDefaultVibrator();
        }
        return (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
    }
}
