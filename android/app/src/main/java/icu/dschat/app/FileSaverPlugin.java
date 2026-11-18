package icu.dschat.app;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * WebView 没有下载管理器，&lt;a download&gt; 在壳里不会产生任何结果。
 * 这里用 begin / chunk / finish 分块写入系统下载目录：
 * 历史里带图片时导出文件可能很大，一次性传一个 base64 字符串会撑爆内存。
 */
@CapacitorPlugin(name = "FileSaver")
public class FileSaverPlugin extends Plugin {

    private final Map<String, Pending> pending = new HashMap<>();

    private static final class Pending {

        final OutputStream out;
        final Uri uri;
        final File file;
        final String displayPath;

        Pending(OutputStream out, Uri uri, File file, String displayPath) {
            this.out = out;
            this.uri = uri;
            this.file = file;
            this.displayPath = displayPath;
        }
    }

    @PluginMethod
    public void begin(PluginCall call) {
        String name = call.getString("name", "ds-chat-export.zip");
        String mime = call.getString("mime", "application/octet-stream");
        String token = UUID.randomUUID().toString();
        try {
            Pending target = create(name, mime);
            synchronized (pending) {
                pending.put(token, target);
            }
            JSObject result = new JSObject();
            result.put("token", token);
            call.resolve(result);
        } catch (Exception error) {
            call.reject(error.getMessage() == null ? "无法创建导出文件" : error.getMessage());
        }
    }

    @PluginMethod
    public void chunk(PluginCall call) {
        String token = call.getString("token");
        String data = call.getString("data");
        if (token == null || data == null) {
            call.reject("缺少分块参数");
            return;
        }
        Pending target;
        synchronized (pending) {
            target = pending.get(token);
        }
        if (target == null) {
            call.reject("导出任务已失效");
            return;
        }
        try {
            byte[] bytes = Base64.decode(data, Base64.NO_WRAP);
            target.out.write(bytes);
            call.resolve();
        } catch (Exception error) {
            call.reject(error.getMessage() == null ? "写入分块失败" : error.getMessage());
        }
    }

    @PluginMethod
    public void finish(PluginCall call) {
        String token = call.getString("token");
        Pending target = take(token);
        if (target == null) {
            call.reject("导出任务已失效");
            return;
        }
        try {
            target.out.flush();
            target.out.close();
            publish(target);
            JSObject result = new JSObject();
            result.put("path", target.displayPath);
            call.resolve(result);
        } catch (Exception error) {
            cleanup(target);
            call.reject(error.getMessage() == null ? "保存文件失败" : error.getMessage());
        }
    }

    @PluginMethod
    public void abort(PluginCall call) {
        Pending target = take(call.getString("token"));
        if (target != null) {
            cleanup(target);
        }
        call.resolve();
    }

    private Pending take(String token) {
        if (token == null) {
            return null;
        }
        synchronized (pending) {
            return pending.remove(token);
        }
    }

    private Pending create(String name, String mime) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            values.put(
                    MediaStore.MediaColumns.RELATIVE_PATH,
                    Environment.DIRECTORY_DOWNLOADS + "/DS-Chat");
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);
            Uri uri =
                    getContext()
                            .getContentResolver()
                            .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                throw new Exception("无法创建下载文件");
            }
            OutputStream out = getContext().getContentResolver().openOutputStream(uri);
            if (out == null) {
                getContext().getContentResolver().delete(uri, null, null);
                throw new Exception("无法写入下载文件");
            }
            return new Pending(out, uri, null, "下载/DS-Chat/" + name);
        }

        File dir = new File(
                getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "DS-Chat");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new Exception("无法创建下载目录");
        }
        File file = new File(dir, name);
        return new Pending(new FileOutputStream(file), null, file, file.getAbsolutePath());
    }

    private void publish(Pending target) {
        if (target.uri == null) {
            return;
        }
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.IS_PENDING, 0);
        getContext().getContentResolver().update(target.uri, values, null, null);
    }

    private void cleanup(Pending target) {
        try {
            target.out.close();
        } catch (Exception ignored) {
            // 关闭失败不影响删除
        }
        try {
            if (target.uri != null) {
                getContext().getContentResolver().delete(target.uri, null, null);
            } else if (target.file != null && target.file.exists()) {
                // 未完成的临时文件不留在用户可见目录
                target.file.delete();
            }
        } catch (Exception ignored) {
            // 清理失败时保留文件，不覆盖原始错误
        }
    }
}
