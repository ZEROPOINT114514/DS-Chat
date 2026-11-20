package icu.dschat.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.provider.MediaStore;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;

/**
 * 系统相机拍照：照片只写进应用缓存目录，网页读成 Blob 后立即调用 release 删除，
 * 因此不会出现在系统相册里。
 */
@CapacitorPlugin(
        name = "Camera",
        permissions = {@Permission(alias = "camera", strings = {Manifest.permission.CAMERA})})
public class CameraPlugin extends Plugin {

    private File pendingFile;

    @PluginMethod
    public void capture(PluginCall call) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            requestPermissionForAlias("camera", call, "cameraPermissionCallback");
            return;
        }
        launch(call);
    }

    @PermissionCallback
    private void cameraPermissionCallback(PluginCall call) {
        if (getPermissionState("camera") == PermissionState.GRANTED) {
            launch(call);
        } else {
            call.reject("需要相机权限才能拍照");
        }
    }

    private void launch(PluginCall call) {
        try {
            File dir = new File(getContext().getCacheDir(), "camera");
            if (!dir.exists() && !dir.mkdirs()) {
                call.reject("无法创建拍照缓存目录");
                return;
            }
            pendingFile = new File(dir, "shot-" + System.currentTimeMillis() + ".jpg");
            Uri uri =
                    FileProvider.getUriForFile(
                            getContext(), getContext().getPackageName() + ".fileprovider", pendingFile);
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            intent.putExtra(MediaStore.EXTRA_OUTPUT, uri);
            intent.addFlags(
                    Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivityForResult(call, intent, "cameraResult");
        } catch (Exception error) {
            pendingFile = null;
            call.reject(error.getMessage() == null ? "无法打开相机" : error.getMessage());
        }
    }

    @ActivityCallback
    private void cameraResult(PluginCall call, androidx.activity.result.ActivityResult result) {
        if (call == null) {
            return;
        }
        File file = pendingFile;
        pendingFile = null;
        if (result.getResultCode() != Activity.RESULT_OK || file == null || !file.exists()) {
            if (file != null) {
                file.delete();
            }
            call.reject("已取消拍照");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("path", file.getAbsolutePath());
        ret.put("name", "photo-" + System.currentTimeMillis() + ".jpg");
        call.resolve(ret);
    }

    /** 网页读完照片后删除临时文件 */
    @PluginMethod
    public void release(PluginCall call) {
        String path = call.getString("path");
        if (path != null) {
            File file = new File(path);
            if (file.exists()) {
                file.delete();
            }
        }
        call.resolve();
    }
}
