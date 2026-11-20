package icu.dschat.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** 把其他应用分享进来的文件交给网页：consume 取一次即清空。 */
@CapacitorPlugin(name = "ShareTarget")
public class ShareTargetPlugin extends Plugin {

    @PluginMethod
    public void consume(PluginCall call) {
        SharedContent.Item item = SharedContent.take();
        JSObject ret = new JSObject();
        if (item == null) {
            ret.put("path", (String) null);
            call.resolve(ret);
            return;
        }
        ret.put("path", item.path);
        ret.put("name", item.name);
        ret.put("mime", item.mime);
        call.resolve(ret);
    }
}
