package icu.dschat.app;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * 用系统「打开方式」打开附件：字节先写进应用缓存，再用 FileProvider 授权给用户选中的应用。
 * 采用 begin / chunk / finish 分块传输：几十 MB 的文档一次塞进一个 base64 字符串会撑爆内存，
 * 而且 Web 侧按 512KB 切块后各块自带的 base64 填充符拼在一起就不是合法 base64 了。
 */
@CapacitorPlugin(name = "FileOpener")
public class FileOpenerPlugin extends Plugin {

    /** 缓存文件保留一天，供用户重新打开；更早的清掉，避免缓存目录无限增长 */
    private static final long STALE_MS = 24L * 60 * 60 * 1000;

    private final Map<String, Pending> pending = new HashMap<>();

    private static final class Pending {

        final FileOutputStream out;
        final File file;
        final String mime;

        Pending(FileOutputStream out, File file, String mime) {
            this.out = out;
            this.file = file;
            this.mime = mime;
        }
    }

    @PluginMethod
    public void begin(PluginCall call) {
        String name = call.getString("name", "file");
        String mime = call.getString("mime", "application/octet-stream");
        File dir = new File(getContext().getCacheDir(), "opened");
        if (!dir.exists() && !dir.mkdirs()) {
            call.reject("无法创建缓存目录");
            return;
        }
        dropStale(dir);
        try {
            String safeName = name.replaceAll("[\\\\/:*?\"<>|]", "_");
            File target = new File(dir, System.currentTimeMillis() + "-" + safeName);
            String token = UUID.randomUUID().toString();
            synchronized (pending) {
                pending.put(token, new Pending(new FileOutputStream(target), target, mime));
            }
            JSObject result = new JSObject();
            result.put("token", token);
            call.resolve(result);
        } catch (Exception error) {
            call.reject(error.getMessage() == null ? "无法创建缓存文件" : error.getMessage());
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
            call.reject("打开任务已失效");
            return;
        }
        try {
            // 每块单独解码，填充符只影响当前块，拼起来的字节流仍然完整
            byte[] bytes = Base64.decode(data, Base64.NO_WRAP);
            synchronized (target) {
                target.out.write(bytes);
            }
            call.resolve();
        } catch (Exception error) {
            call.reject(error.getMessage() == null ? "写入分块失败" : error.getMessage());
        }
    }

    @PluginMethod
    public void finish(PluginCall call) {
        Pending target = take(call.getString("token"));
        if (target == null) {
            call.reject("打开任务已失效");
            return;
        }
        try {
            target.out.flush();
            target.out.close();
            Uri uri =
                    FileProvider.getUriForFile(
                            getContext(),
                            getContext().getPackageName() + ".fileprovider",
                            target.file);
            Intent view = new Intent(Intent.ACTION_VIEW);
            view.setDataAndType(uri, target.mime);
            view.setClipData(ClipData.newRawUri("", uri));
            view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(view, "选择打开方式");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getContext().startActivity(chooser);
            call.resolve();
        } catch (Exception error) {
            target.file.delete();
            call.reject(error.getMessage() == null ? "无法打开文件" : error.getMessage());
        }
    }

    @PluginMethod
    public void abort(PluginCall call) {
        Pending target = take(call.getString("token"));
        if (target != null) {
            close(target);
            target.file.delete();
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

    private void close(Pending target) {
        try {
            target.out.flush();
            target.out.close();
        } catch (Exception ignored) {
            // 关闭失败不影响后续清理
        }
    }

    private void dropStale(File dir) {
        File[] files = dir.listFiles();
        if (files == null) {
            return;
        }
        long deadline = System.currentTimeMillis() - STALE_MS;
        for (File file : files) {
            if (file.isFile() && file.lastModified() < deadline) {
                file.delete();
            }
        }
    }
}
