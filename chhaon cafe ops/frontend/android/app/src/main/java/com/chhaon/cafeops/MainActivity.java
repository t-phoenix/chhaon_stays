package com.chhaon.cafeops;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.chhaon.meshdiscovery.CafeMeshDiscoveryPlugin;
import com.chhaon.meshsignaling.CafeMeshSignalingPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CafeMeshDiscoveryPlugin.class);
        registerPlugin(CafeMeshSignalingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
