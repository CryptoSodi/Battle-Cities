package com.battlecities.game;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.content.pm.PackageManager;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class BattleCitiesFirebaseMessagingService extends FirebaseMessagingService {
    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        getSharedPreferences(
            BattleCitiesNotificationsPlugin.PREFERENCES_NAME,
            Context.MODE_PRIVATE
        ).edit().putString(BattleCitiesNotificationsPlugin.TOKEN_KEY, token).apply();
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        super.onMessageReceived(message);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        BattleCitiesNotificationsPlugin.ensureNotificationChannel(this);

        Map<String, String> data = message.getData();
        RemoteMessage.Notification notification = message.getNotification();
        String title = value(data, "title", notification == null ? "Battle Cities" : notification.getTitle());
        String body = value(data, "body", notification == null ? "You have a new update." : notification.getBody());

        Intent intent = new Intent(this, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(
            this,
            BattleCitiesNotificationsPlugin.CHANNEL_ID
        )
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(contentIntent);

        NotificationManagerCompat.from(this).notify(
            (int) (System.currentTimeMillis() & 0x7fffffff),
            builder.build()
        );
    }

    private String value(Map<String, String> data, String key, String fallback) {
        String value = data.get(key);
        return value == null || value.trim().isEmpty() ? fallback : value;
    }
}
