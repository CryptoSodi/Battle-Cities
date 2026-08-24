package com.battlecities.game;

import android.app.PendingIntent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.content.pm.PackageManager;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;

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

        Intent intent = createDestinationIntent(data);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            (int) (System.currentTimeMillis() & 0x7fffffff),
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
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(contentIntent);

        Bitmap image = loadImage(value(data, "imageUrl", ""));
        if (image == null) {
            builder.setStyle(new NotificationCompat.BigTextStyle().bigText(body));
        } else {
            builder.setLargeIcon(image);
            builder.setStyle(new NotificationCompat.BigPictureStyle().bigPicture(image).bigLargeIcon(null));
        }

        String actionLabel = value(data, "actionLabel", "");
        if (!actionLabel.isEmpty()) {
            builder.addAction(0, actionLabel, contentIntent);
        }

        NotificationManagerCompat.from(this).notify(
            (int) (System.currentTimeMillis() & 0x7fffffff),
            builder.build()
        );
    }

    private String value(Map<String, String> data, String key, String fallback) {
        String value = data.get(key);
        return value == null || value.trim().isEmpty() ? fallback : value;
    }

    private Intent createDestinationIntent(Map<String, String> data) {
        String route = value(data, "route", "home");
        if (route.equals("external")) {
            String externalUrl = value(data, "externalUrl", "");
            Uri uri = Uri.parse(externalUrl);
            if ("https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null) {
                return new Intent(Intent.ACTION_VIEW, uri);
            }
        }
        if (route.equals("share")) {
            Intent share = new Intent(Intent.ACTION_SEND);
            share.setType("text/plain");
            share.putExtra(Intent.EXTRA_TEXT, "Join me in Battle Cities: https://battlecities.com");
            return Intent.createChooser(share, "Share Battle Cities");
        }
        return new Intent(this, MainActivity.class)
            .putExtra("battlecities_notification_route", route)
            .putExtra("battlecities_notification_type", value(data, "type", "announcement"))
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    }

    private Bitmap loadImage(String source) {
        if (source.isEmpty()) return null;
        try {
            URL url = new URL(source);
            if (!"https".equalsIgnoreCase(url.getProtocol()) || url.getHost().isEmpty()) return null;
            HttpsURLConnection connection = (HttpsURLConnection) url.openConnection();
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            connection.setInstanceFollowRedirects(false);
            try {
                return BitmapFactory.decodeStream(connection.getInputStream());
            } finally {
                connection.disconnect();
            }
        } catch (Exception ignored) {
            return null;
        }
    }
}
