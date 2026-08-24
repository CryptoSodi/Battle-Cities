package com.battlecities.game;

import android.graphics.Color;
import android.os.Bundle;
import android.content.Context;
import android.content.Intent;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private NativeGamepadBridge nativeGamepadBridge;

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (nativeGamepadBridge != null && nativeGamepadBridge.handleKeyEvent(event)) {
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    public boolean onGenericMotionEvent(MotionEvent event) {
        if (nativeGamepadBridge != null && nativeGamepadBridge.handleMotionEvent(event)) {
            return true;
        }
        return super.onGenericMotionEvent(event);
    }

    @Override
    public void onPause() {
        if (nativeGamepadBridge != null) {
            nativeGamepadBridge.reset();
        }
        super.onPause();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        WebView webView = getBridge() == null
            ? null
            : (WebView) getBridge().getWebView();
        if (webView == null) {
            performDefaultBack();
            return;
        }

        webView.evaluateJavascript(
            "(function(){"
                + "const event = new Event('battlecities:android-back', { cancelable: true });"
                + "window.dispatchEvent(event);"
                + "return event.defaultPrevented;"
                + "})()",
            handled -> {
                if (!Boolean.parseBoolean(handled)) {
                    performDefaultBack();
                }
            }
        );
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(AndroidDevicePlugin.class);
        registerPlugin(BattleCitiesNotificationsPlugin.class);
        registerPlugin(GoogleAuthPlugin.class);
        registerPlugin(SolanaMobileWalletPlugin.class);
        super.onCreate(savedInstanceState);
        cacheNotificationIntent(getIntent());
        BattleCitiesNotificationsPlugin.ensureNotificationChannel(this);
        nativeGamepadBridge = new NativeGamepadBridge(getBridge().getWebView());
        WebBundleUpdater.enqueue(this);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);

        WindowInsetsControllerCompat insetsController =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        insetsController.setAppearanceLightStatusBars(false);
        insetsController.setAppearanceLightNavigationBars(false);

        View webView = getBridge().getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (view, windowInsets) -> {
            Insets systemBars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            ViewGroup.MarginLayoutParams layoutParams =
                (ViewGroup.MarginLayoutParams) webView.getLayoutParams();
            layoutParams.setMargins(
                systemBars.left,
                systemBars.top,
                systemBars.right,
                systemBars.bottom
            );
            webView.setLayoutParams(layoutParams);
            return windowInsets;
        });
        ViewCompat.requestApplyInsets(getWindow().getDecorView());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (!cacheNotificationIntent(intent)) {
            return;
        }
        WebView webView = getBridge() == null ? null : (WebView) getBridge().getWebView();
        if (webView != null) {
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('battlecities:notification', { detail: JSON.parse("
                    + JSONObject.quote(readPendingNotification()) + ") }));",
                ignored -> clearPendingNotification()
            );
        }
    }

    private boolean cacheNotificationIntent(Intent intent) {
        String route = intent.getStringExtra("battlecities_notification_route");
        if (route == null || route.trim().isEmpty()) {
            return false;
        }
        JSONObject payload = new JSONObject();
        try {
            payload.put("route", route);
            payload.put("type", intent.getStringExtra("battlecities_notification_type"));
        } catch (Exception ignored) {
            return false;
        }
        getSharedPreferences(
            BattleCitiesNotificationsPlugin.PREFERENCES_NAME,
            Context.MODE_PRIVATE
        ).edit().putString(BattleCitiesNotificationsPlugin.PENDING_NOTIFICATION_KEY, payload.toString()).apply();
        return true;
    }

    private String readPendingNotification() {
        return getSharedPreferences(
            BattleCitiesNotificationsPlugin.PREFERENCES_NAME,
            Context.MODE_PRIVATE
        ).getString(BattleCitiesNotificationsPlugin.PENDING_NOTIFICATION_KEY, "{}");
    }

    private void clearPendingNotification() {
        getSharedPreferences(
            BattleCitiesNotificationsPlugin.PREFERENCES_NAME,
            Context.MODE_PRIVATE
        ).edit().remove(BattleCitiesNotificationsPlugin.PENDING_NOTIFICATION_KEY).apply();
    }

    @SuppressWarnings("deprecation")
    private void performDefaultBack() {
        super.onBackPressed();
    }
}
