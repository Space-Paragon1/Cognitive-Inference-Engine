package com.cognitiveloadrouter.app;

import android.content.res.Configuration;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private int nightMode;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        nightMode = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
    }

    /**
     * The phone's dark mode changed while the app is open. The activity isn't recreated
     * (uiMode is in configChanges), so the WebView keeps reporting the old
     * prefers-color-scheme and Android resets the status bar icons to the phone's
     * setting. The web app gets a "clrsystemtheme" event instead, re-applies its
     * theme and sets the icons to match it (see live/PrefsState.tsx).
     */
    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        int night = newConfig.uiMode & Configuration.UI_MODE_NIGHT_MASK;        if (night == nightMode || bridge == null) return;
        nightMode = night;
        String scheme = night == Configuration.UI_MODE_NIGHT_YES ? "dark" : "light";
        bridge.triggerWindowJSEvent("clrsystemtheme", "{ \"scheme\": \"" + scheme + "\" }");
    }
}
