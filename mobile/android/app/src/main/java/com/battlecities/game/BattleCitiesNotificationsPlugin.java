package com.battlecities.game;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;
import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.messaging.FirebaseMessaging;

@CapacitorPlugin(name = "BattleCitiesNotifications")
public class BattleCitiesNotificationsPlugin extends Plugin {
    public static final String CHANNEL_ID = "battle-cities-notifications";
    public static final String PREFERENCES_NAME = "battle_cities_notifications";
    public static final String TOKEN_KEY = "fcm_token";
    public static final String PENDING_NOTIFICATION_KEY = "pending_notification";
    private static final String REQUESTED_PERMISSION_KEY = "requested_permission";
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 4102;

    @PluginMethod
    public void getRegistration(PluginCall call) {
        if (!hasGooglePlayServices()) {
            call.resolve(registration(null, "unavailable"));
            return;
        }

        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(
            new OnCompleteListener<String>() {
                @Override
                public void onComplete(Task<String> task) {
                    if (!task.isSuccessful()) {
                        call.resolve(registration(readToken(), permissionState()));
                        return;
                    }

                    String token = task.getResult();
                    if (token != null && !token.isEmpty()) {
                        preferences().edit().putString(TOKEN_KEY, token).apply();
                    }
                    call.resolve(registration(token, permissionState()));
                }
            }
        );
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || isPermissionGranted()) {
            call.resolve(registration(readToken(), permissionState()));
            return;
        }

        preferences().edit().putBoolean(REQUESTED_PERMISSION_KEY, true).apply();
        ActivityCompat.requestPermissions(
            getActivity(),
            new String[] { Manifest.permission.POST_NOTIFICATIONS },
            NOTIFICATION_PERMISSION_REQUEST_CODE
        );
        call.resolve(registration(readToken(), "prompted"));
    }

    @PluginMethod
    public void consumePendingNotification(PluginCall call) {
        String payload = preferences().getString(PENDING_NOTIFICATION_KEY, "");
        preferences().edit().remove(PENDING_NOTIFICATION_KEY).apply();
        JSObject result = new JSObject();
        result.put("payload", payload);
        call.resolve(result);
    }

    public static void ensureNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Battle Cities",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Match, reward, and Battle Cities updates");
        manager.createNotificationChannel(channel);
    }

    private boolean hasGooglePlayServices() {
        return GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(getContext())
            == ConnectionResult.SUCCESS;
    }

    private boolean isPermissionGranted() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(
                getContext(),
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED;
    }

    private String permissionState() {
        if (!hasGooglePlayServices()) {
            return "unavailable";
        }
        if (isPermissionGranted()) {
            return "granted";
        }
        return preferences().getBoolean(REQUESTED_PERMISSION_KEY, false)
            ? "denied"
            : "prompt";
    }

    private JSObject registration(String token, String permission) {
        JSObject result = new JSObject();
        result.put("supported", hasGooglePlayServices());
        result.put("token", token);
        result.put("permission", permission);
        return result;
    }

    private String readToken() {
        return preferences().getString(TOKEN_KEY, null);
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
    }
}
