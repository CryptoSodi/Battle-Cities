package com.battlecities.game;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.AssetManager;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

final class WebBundleUpdater {
    private static final String TAG = "BattleCitiesUpdate";
    private static final String BASE_URL = "https://www.battlecities.com";
    private static final String MANIFEST_NAME = "web-version.json";
    private static final String CAP_PREFS = "CapWebViewSettings";
    private static final String CAP_SERVER_PATH = "serverBasePath";
    private static final int TIMEOUT_MS = 30_000;
    private static final long MAX_FILE_SIZE = 150L * 1024L * 1024L;
    private static final long MAX_BUNDLE_SIZE = 500L * 1024L * 1024L;
    private static final String WORK_NAME = "battle-cities-web-bundle-update";

    private WebBundleUpdater() {}

    static void enqueue(Context context) {
        Constraints constraints = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build();
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(BundleUpdateWorker.class)
            .setConstraints(constraints)
            .build();
        WorkManager.getInstance(context.getApplicationContext()).enqueueUniqueWork(
            WORK_NAME,
            ExistingWorkPolicy.KEEP,
            request
        );
    }

    public static final class BundleUpdateWorker extends Worker {
        public BundleUpdateWorker(@NonNull Context context, @NonNull WorkerParameters parameters) {
            super(context, parameters);
        }

        @NonNull
        @Override
        public Result doWork() {
            try {
                update(getApplicationContext());
                return Result.success();
            } catch (Exception error) {
                Log.w(TAG, "Web bundle update attempt failed", error);
                return getRunAttemptCount() < 3 ? Result.retry() : Result.failure();
            }
        }
    }

    private static void update(Context context) throws Exception {
        JSONObject remoteJson = fetchManifest();
        Manifest remote = parseManifest(remoteJson);
        CurrentBundle current = readCurrentBundle(context);
        if (remote.version.equals(current.manifest.version)) {
            return;
        }

        File bundles = new File(context.getFilesDir(), "web-bundles");
        ensureDirectory(bundles);
        File staging = new File(bundles, ".staging-" + remote.version);
        deleteRecursively(staging);
        ensureDirectory(staging);

        try {
            if (current.directory == null) {
                copyAssets(context.getAssets(), "public", staging);
            } else {
                copyDirectory(current.directory, staging);
            }

            Set<String> allowed = new HashSet<>();
            long totalSize = 0;
            for (ManifestFile file : remote.files) {
                totalSize += file.size;
                if (file.size < 0 || file.size > MAX_FILE_SIZE || totalSize > MAX_BUNDLE_SIZE) {
                    throw new IOException("Remote bundle exceeds size limits");
                }
                allowed.add(file.path);
                File local = safeChild(staging, file.path);
                if (!local.isFile() || !file.sha256.equals(sha256(local))) {
                    download(file, local);
                }
            }

            allowed.add(MANIFEST_NAME);
            removeUnknownFiles(staging, staging, allowed);
            writeJson(new File(staging, MANIFEST_NAME), remoteJson);
            verify(staging, remote);

            File target = new File(bundles, remote.version);
            deleteRecursively(target);
            if (!staging.renameTo(target)) {
                throw new IOException("Could not activate downloaded bundle");
            }

            SharedPreferences preferences = context.getSharedPreferences(CAP_PREFS, Context.MODE_PRIVATE);
            String previous = preferences.getString(CAP_SERVER_PATH, null);
            preferences.edit().putString(CAP_SERVER_PATH, target.getAbsolutePath()).apply();
            cleanupOldBundles(bundles, target.getAbsolutePath(), previous);
            Log.i(TAG, "Bundle " + remote.version + " activates next launch");
        } catch (Exception error) {
            deleteRecursively(staging);
            throw error;
        }
    }

    private static JSONObject fetchManifest() throws Exception {
        HttpURLConnection connection = connect(
            new URL(BASE_URL + "/" + MANIFEST_NAME + "?t=" + System.currentTimeMillis())
        );
        connection.setRequestProperty("Cache-Control", "no-cache");
        try {
            requireSuccess(connection, MANIFEST_NAME);
            return new JSONObject(readUtf8(connection.getInputStream(), 8 * 1024 * 1024));
        } finally {
            connection.disconnect();
        }
    }

    private static CurrentBundle readCurrentBundle(Context context) throws Exception {
        SharedPreferences preferences = context.getSharedPreferences(CAP_PREFS, Context.MODE_PRIVATE);
        String activePath = preferences.getString(CAP_SERVER_PATH, null);
        if (activePath != null) {
            File directory = new File(activePath);
            File manifest = new File(directory, MANIFEST_NAME);
            if (directory.isDirectory() && manifest.isFile()) {
                return new CurrentBundle(directory, parseManifest(readJson(manifest)));
            }
        }

        try (InputStream input = context.getAssets().open("public/" + MANIFEST_NAME)) {
            return new CurrentBundle(null, parseManifest(new JSONObject(readUtf8(input, 8 * 1024 * 1024))));
        }
    }

    private static Manifest parseManifest(JSONObject json) throws Exception {
        String version = json.getString("version");
        String generatedAt = json.getString("generatedAt");
        if (!version.matches("[a-f0-9]{20}")) {
            throw new IOException("Invalid bundle version");
        }
        if (!generatedAt.matches("\\d{4}-\\d{2}-\\d{2}T.*Z")) {
            throw new IOException("Invalid bundle timestamp");
        }
        JSONArray values = json.getJSONArray("files");
        if (values.length() > 20_000) {
            throw new IOException("Bundle contains too many files");
        }
        List<ManifestFile> files = new ArrayList<>();
        for (int index = 0; index < values.length(); index += 1) {
            JSONObject value = values.getJSONObject(index);
            String path = value.getString("path");
            String hash = value.getString("sha256");
            validatePath(path);
            if (!hash.matches("[a-f0-9]{64}")) {
                throw new IOException("Invalid hash for " + path);
            }
            files.add(new ManifestFile(path, hash, value.getLong("size")));
        }
        return new Manifest(version, generatedAt, files);
    }

    private static void download(ManifestFile file, File destination) throws Exception {
        ensureDirectory(destination.getParentFile());
        String path = new URI(null, null, "/" + file.path, null).toASCIIString();
        // Cache-bust with the manifest hash so a stale edge/CDN copy can never
        // cause a sha256 verification failure. The CDN must serve the exact
        // content the manifest advertises.
        HttpURLConnection connection = connect(
            new URL(BASE_URL + path + "?bundle=" + file.sha256)
        );
        File temporary = new File(destination.getParentFile(), destination.getName() + ".download");
        try {
            requireSuccess(connection, file.path);
            long received = copy(connection.getInputStream(), new FileOutputStream(temporary));
            if (received != file.size || !file.sha256.equals(sha256(temporary))) {
                throw new IOException("Downloaded file failed verification: " + file.path);
            }
            if (destination.exists() && !destination.delete()) {
                throw new IOException("Could not replace " + file.path);
            }
            if (!temporary.renameTo(destination)) {
                throw new IOException("Could not store " + file.path);
            }
        } finally {
            connection.disconnect();
            if (temporary.exists()) {
                temporary.delete();
            }
        }
    }

    private static HttpURLConnection connect(URL url) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(TIMEOUT_MS);
        connection.setInstanceFollowRedirects(true);
        connection.setRequestProperty("Accept-Encoding", "identity");
        return connection;
    }

    private static void requireSuccess(HttpURLConnection connection, String name) throws IOException {
        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IOException("HTTP " + status + " for " + name);
        }
    }

    private static void verify(File root, Manifest manifest) throws Exception {
        for (ManifestFile file : manifest.files) {
            File local = safeChild(root, file.path);
            if (!local.isFile() || local.length() != file.size || !file.sha256.equals(sha256(local))) {
                throw new IOException("Bundle verification failed: " + file.path);
            }
        }
    }

    private static void copyAssets(AssetManager assets, String path, File destination) throws IOException {
        String[] children = assets.list(path);
        if (children == null) {
            throw new IOException("Could not read packaged bundle");
        }
        ensureDirectory(destination);
        for (String child : children) {
            String childPath = path + "/" + child;
            String[] descendants = assets.list(childPath);
            File target = new File(destination, child);
            if (descendants != null && descendants.length > 0) {
                copyAssets(assets, childPath, target);
            } else {
                ensureDirectory(target.getParentFile());
                try (InputStream input = assets.open(childPath); FileOutputStream output = new FileOutputStream(target)) {
                    copy(input, output);
                }
            }
        }
    }

    private static void copyDirectory(File source, File destination) throws IOException {
        ensureDirectory(destination);
        File[] children = source.listFiles();
        if (children == null) {
            throw new IOException("Could not read " + source);
        }
        for (File child : children) {
            File target = new File(destination, child.getName());
            if (child.isDirectory()) {
                copyDirectory(child, target);
            } else {
                try (FileInputStream input = new FileInputStream(child); FileOutputStream output = new FileOutputStream(target)) {
                    copy(input, output);
                }
            }
        }
    }

    private static void removeUnknownFiles(File root, File directory, Set<String> allowed) throws IOException {
        File[] children = directory.listFiles();
        if (children == null) {
            return;
        }
        for (File child : children) {
            if (child.isDirectory()) {
                removeUnknownFiles(root, child, allowed);
                File[] remaining = child.listFiles();
                if (remaining != null && remaining.length == 0) {
                    child.delete();
                }
            } else {
                String relative = root.toURI().relativize(child.toURI()).getPath();
                if (!allowed.contains(relative) && !child.delete()) {
                    throw new IOException("Could not remove obsolete " + relative);
                }
            }
        }
    }

    private static void cleanupOldBundles(File root, String active, String previous) {
        File[] children = root.listFiles();
        if (children == null) {
            return;
        }
        for (File child : children) {
            String path = child.getAbsolutePath();
            if (!path.equals(active) && (previous == null || !path.equals(previous))) {
                deleteRecursively(child);
            }
        }
    }

    private static File safeChild(File root, String path) throws IOException {
        validatePath(path);
        File child = new File(root, path);
        if (!child.getCanonicalPath().startsWith(root.getCanonicalPath() + File.separator)) {
            throw new IOException("Unsafe bundle path");
        }
        return child;
    }

    private static void validatePath(String path) throws IOException {
        if (path.isEmpty() || path.startsWith("/") || path.startsWith("\\") || path.contains("..") || path.contains("\\")) {
            throw new IOException("Invalid bundle path: " + path);
        }
    }

    private static JSONObject readJson(File file) throws Exception {
        return new JSONObject(readUtf8(new FileInputStream(file), 8 * 1024 * 1024));
    }

    private static String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new BufferedInputStream(new FileInputStream(file))) {
            byte[] buffer = new byte[32 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
        }
        StringBuilder result = new StringBuilder();
        for (byte value : digest.digest()) {
            result.append(String.format("%02x", value & 0xff));
        }
        return result.toString();
    }

    private static long copy(InputStream rawInput, FileOutputStream rawOutput) throws IOException {
        try (BufferedInputStream input = new BufferedInputStream(rawInput);
             BufferedOutputStream output = new BufferedOutputStream(rawOutput)) {
            byte[] buffer = new byte[32 * 1024];
            long total = 0;
            int read;
            while ((read = input.read(buffer)) != -1) {
                total += read;
                if (total > MAX_FILE_SIZE) {
                    throw new IOException("File exceeds size limit");
                }
                output.write(buffer, 0, read);
            }
            return total;
        }
    }

    private static String readUtf8(InputStream rawInput, int maximum) throws IOException {
        try (InputStream input = rawInput; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8 * 1024];
            int total = 0;
            int read;
            while ((read = input.read(buffer)) != -1) {
                total += read;
                if (total > maximum) {
                    throw new IOException("Manifest exceeds size limit");
                }
                output.write(buffer, 0, read);
            }
            return output.toString("UTF-8");
        }
    }

    private static void writeJson(File file, JSONObject json) throws Exception {
        try (FileOutputStream output = new FileOutputStream(file)) {
            output.write(json.toString(2).getBytes("UTF-8"));
        }
    }

    private static void ensureDirectory(File directory) throws IOException {
        if (directory == null || (!directory.isDirectory() && !directory.mkdirs())) {
            throw new IOException("Could not create " + directory);
        }
    }

    private static void deleteRecursively(File file) {
        if (file == null || !file.exists()) {
            return;
        }
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursively(child);
                }
            }
        }
        file.delete();
    }

    private static final class CurrentBundle {
        final File directory;
        final Manifest manifest;
        CurrentBundle(File directory, Manifest manifest) {
            this.directory = directory;
            this.manifest = manifest;
        }
    }

    private static final class Manifest {
        final String version;
        final String generatedAt;
        final List<ManifestFile> files;
        Manifest(String version, String generatedAt, List<ManifestFile> files) {
            this.version = version;
            this.generatedAt = generatedAt;
            this.files = files;
        }
    }

    private static final class ManifestFile {
        final String path;
        final String sha256;
        final long size;
        ManifestFile(String path, String sha256, long size) {
            this.path = path;
            this.sha256 = sha256;
            this.size = size;
        }
    }
}
