package com.mydailyhint.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-local plugins must be registered before the bridge is created.
        registerPlugin(HintDeviceCredentialPlugin.class);
        registerPlugin(HintSpeechRecognitionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
