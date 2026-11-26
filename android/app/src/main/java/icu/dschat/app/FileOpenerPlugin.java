package icu.dschat.app;

import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import android.util.Base64;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;

/**
 * 用系统「打开方式」打开附件：先把字节写进应用缓存，再用 FileProvider 授权给选择的应用。
 * 这样 PDF、Office 文档等可以交给用户自己挑应用，避免 WebView 直接下载/白屏。
 */
@CapacitorPlugin(name = "FileOpener")
public class FileOpenerPlugin extends Plugin {

    @PluginMethod
    public void open(PluginCall call) {
        String name = call.getString("name", "file");
        String mime = call.getString("mime", "application/octet-stream");
        String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            call.reject("缺少文件数据");
            return;
        }

        byte[] bytes;
        try {
            bytes = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException error) {
            call.reject("文件数据解析失败");
            return;
        }

        try {
            File dir = new File(getContext().getCacheDir(), "opened");
            if (!dir.exists() && !dir.mkdirs()) {
                call.reject("无法创建缓存目录");
                return;
            }
            String safeName = name.replaceAll("[\\\\/:*?\"<>|]", "_");
            File target = new File(dir, System.currentTimeMillis() + "-" + safeName);
            try (FileOutputStream out = new FileOutputStream(target)) {
                out.write(bytes);
            }

            Uri uri =
                    FileProvider.getUriForFile(
                            getContext(), getContext().getPackageName() + ".fileprovider", target);
            Intent view = new Intent(Intent.ACTION_VIEW);
            view.setDataAndType(uri, mime);
            view.addFlags(
                    Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            Intent chooser = Intent.createChooser(view, "选择打开方式");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(chooser);
            call.resolve();
        } catch (Exception error) {
            call.reject(error.getMessage() == null ? "无法打开文件" : error.getMessage());
        }
    }
}
