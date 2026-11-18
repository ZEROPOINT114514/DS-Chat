package icu.dschat.app;

import android.graphics.Color;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 把网页的实际底色同步到状态栏与导航栏，并按深浅色切换图标明暗。
 * 应用内主题可以独立于系统深浅色，因此不能只依赖 values-night 资源。
 */
@CapacitorPlugin(name = "ThemeBars")
public class ThemeBarsPlugin extends Plugin {

    @PluginMethod
    public void apply(PluginCall call) {
        String color = call.getString("color", "#FFFFFF");
        boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", false));

        getActivity().runOnUiThread(() -> {
            try {
                Window window = getActivity().getWindow();
                int argb = Color.parseColor(color);
                window.setStatusBarColor(argb);
                window.setNavigationBarColor(argb);

                WindowInsetsControllerCompat controller =
                        WindowCompat.getInsetsController(window, window.getDecorView());
                controller.setAppearanceLightStatusBars(!dark);
                controller.setAppearanceLightNavigationBars(!dark);
                call.resolve();
            } catch (Exception error) {
                call.reject(error.getMessage());
            }
        });
    }
}
