package icu.dschat.app;

import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/** 其他应用「分享 / 打开方式」传进来的文件，先落到应用缓存，再交给网页作为附件。 */
public final class SharedContent {

    public static final class Item {

        public final String path;
        public final String name;
        public final String mime;

        Item(String path, String name, String mime) {
            this.path = path;
            this.name = name;
            this.mime = mime;
        }
    }

    private static Item pending;

    private SharedContent() {}

    /** 在 Activity 收到 Intent 时调用；只处理带文件流的分享与“用其他应用打开” */
    public static synchronized void capture(Context context, Intent intent) {
        if (intent == null) {
            return;
        }
        String action = intent.getAction();
        Uri uri = null;
        if (Intent.ACTION_SEND.equals(action)) {
            uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        } else if (Intent.ACTION_VIEW.equals(action)) {
            uri = intent.getData();
        }
        if (uri == null) {
            return;
        }

        String mime = context.getContentResolver().getType(uri);
        String name = queryName(context, uri);

        try {
            File dir = new File(context.getCacheDir(), "shared");
            if (!dir.exists() && !dir.mkdirs()) {
                return;
            }
            File target = new File(dir, System.currentTimeMillis() + "-" + sanitize(name));
            try (
                InputStream in = context.getContentResolver().openInputStream(uri);
                OutputStream out = new FileOutputStream(target)) {
                if (in == null) {
                    return;
                }
                byte[] buffer = new byte[16 * 1024];
                int read;
                while ((read = in.read(buffer)) > 0) {
                    out.write(buffer, 0, read);
                }
            }
            pending = new Item(target.getAbsolutePath(), name, mime);
        } catch (Exception ignored) {
            // 读取失败时保持没有待处理文件，网页侧不会收到附件
        }
    }

    /** 取走待处理文件，取过一次就清空，避免重复发送 */
    public static synchronized Item take() {
        Item item = pending;
        pending = null;
        return item;
    }

    private static String queryName(Context context, Uri uri) {
        try (Cursor cursor =
                context.getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) {
                    String name = cursor.getString(index);
                    if (name != null && !name.isEmpty()) {
                        return name;
                    }
                }
            }
        } catch (Exception ignored) {
            // 部分 provider 不支持查询，退回默认名字
        }
        String last = uri.getLastPathSegment();
        return last == null || last.isEmpty() ? "shared-file" : last;
    }

    private static String sanitize(String name) {
        String cleaned = name.replaceAll("[\\\\/:*?\"<>|\\s]+", "_");
        return cleaned.isEmpty() ? "shared-file" : cleaned;
    }
}
