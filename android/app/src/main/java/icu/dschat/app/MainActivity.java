package icu.dschat.app;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 自定义插件必须在 super.onCreate 之前注册
        registerPlugin(ThemeBarsPlugin.class);
        registerPlugin(FileSaverPlugin.class);
        registerPlugin(CameraPlugin.class);
        registerPlugin(RecentMediaPlugin.class);
        registerPlugin(ShareTargetPlugin.class);
        super.onCreate(savedInstanceState);
        // 冷启动时可能是「其他应用打开」带进来的文件
        SharedContent.capture(this, getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        SharedContent.capture(this, intent);
        notifyShareArrived();
    }

    /** 应用已在前台时收到新的分享，通知网页立刻取走附件 */
    private void notifyShareArrived() {
        WebView webView = getBridge() == null ? null : getBridge().getWebView();
        if (webView == null) {
            return;
        }
        webView.post(
                () ->
                        webView.evaluateJavascript(
                                "(function(){try{window.dsShareArrived&&window.dsShareArrived()}catch(e){}})()",
                                null));
    }

    /**
     * 返回键先问网页：网页关掉浮层（图片预览、设置、搜索、侧边栏）就消费掉，
     * 没有浮层时才退出，避免打开图片后一按返回就整个 App 退出。
     */
    @Override
    public void onBackPressed() {
        WebView webView = getBridge() == null ? null : getBridge().getWebView();
        if (webView == null) {
            systemBack();
            return;
        }
        webView.evaluateJavascript(
                "(function(){try{return !!(window.__dsHandleBack&&window.__dsHandleBack())}catch(e){return false}})()",
                value -> {
                    if ("true".equals(value)) {
                        return;
                    }
                    runOnUiThread(this::systemBack);
                });
    }

    private void systemBack() {
        super.onBackPressed();
    }
}
