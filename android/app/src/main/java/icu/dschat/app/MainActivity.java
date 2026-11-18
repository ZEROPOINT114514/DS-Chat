package icu.dschat.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 自定义插件必须在 super.onCreate 之前注册
        registerPlugin(ThemeBarsPlugin.class);
        registerPlugin(FileSaverPlugin.class);
        super.onCreate(savedInstanceState);
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
