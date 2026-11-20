package icu.dschat.app;

import android.content.ContentUris;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Size;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/** 相册最近照片：缩略图写进缓存供面板显示，选中时把原图复制到缓存再交给网页。 */
@CapacitorPlugin(name = "RecentMedia")
public class RecentMediaPlugin extends Plugin {

    @PluginMethod
    public void list(PluginCall call) {
        int limit = Math.max(0, Math.min(call.getInt("limit", 8), 20));
        JSArray items = new JSArray();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || limit == 0) {
            JSObject ret = new JSObject();
            ret.put("items", items);
            call.resolve(ret);
            return;
        }
        Uri collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
        String[] projection = {MediaStore.Images.Media._ID, MediaStore.Images.Media.DISPLAY_NAME};
        String order = MediaStore.Images.Media.DATE_ADDED + " DESC";
        try (Cursor cursor =
                getContext()
                        .getContentResolver()
                        .query(collection, projection, null, null, order)) {
            if (cursor != null) {
                int idColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID);
                int nameColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME);
                File dir = new File(getContext().getCacheDir(), "thumbs");
                if (!dir.exists()) {
                    dir.mkdirs();
                }
                while (cursor.moveToNext() && items.length() < limit) {
                    long id = cursor.getLong(idColumn);
                    String name = cursor.getString(nameColumn);
                    Uri uri = ContentUris.withAppendedId(collection, id);
                    File thumb = new File(dir, "thumb-" + id + ".jpg");
                    if (!thumb.exists()) {
                        Bitmap bitmap =
                                getContext()
                                        .getContentResolver()
                                        .loadThumbnail(uri, new Size(240, 240), null);
                        try (FileOutputStream out = new FileOutputStream(thumb)) {
                            bitmap.compress(Bitmap.CompressFormat.JPEG, 80, out);
                        }
                        bitmap.recycle();
                    }
                    JSObject item = new JSObject();
                    item.put("uri", uri.toString());
                    item.put("thumbPath", thumb.getAbsolutePath());
                    item.put("name", name == null ? "image.jpg" : name);
                    items.put(item);
                }
            }
        } catch (Exception ignored) {
            // 没有相册读取权限时返回已有结果（通常为空），面板只显示三个入口
        }
        JSObject ret = new JSObject();
        ret.put("items", items);
        call.resolve(ret);
    }

    /** 选中的最近照片：把 content:// 复制到缓存目录，返回可被网页读取的路径 */
    @PluginMethod
    public void open(PluginCall call) {
        String uriString = call.getString("uri");
        String name = call.getString("name", "image.jpg");
        if (uriString == null) {
            call.reject("缺少图片地址");
            return;
        }
        try {
            Uri uri = Uri.parse(uriString);
            File dir = new File(getContext().getCacheDir(), "shared");
            if (!dir.exists()) {
                dir.mkdirs();
            }
            File target = new File(dir, System.currentTimeMillis() + "-" + name.replaceAll("[\\\\/:*?\"<>|]", "_"));
            try (
                InputStream in = getContext().getContentResolver().openInputStream(uri);
                OutputStream out = new FileOutputStream(target)) {
                if (in == null) {
                    call.reject("无法读取该图片");
                    return;
                }
                byte[] buffer = new byte[16 * 1024];
                int read;
                while ((read = in.read(buffer)) > 0) {
                    out.write(buffer, 0, read);
                }
            }
            JSObject ret = new JSObject();
            ret.put("path", target.getAbsolutePath());
            ret.put("name", name);
            call.resolve(ret);
        } catch (Exception error) {
            call.reject(error.getMessage() == null ? "无法读取该图片" : error.getMessage());
        }
    }
}
