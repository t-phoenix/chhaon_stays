package com.chhaon.meshdiscovery

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject
import java.net.InetAddress
import java.util.concurrent.ConcurrentHashMap

@CapacitorPlugin(name = "CafeMeshDiscovery")
class CafeMeshDiscoveryPlugin : Plugin() {

    private var nsdManager: NsdManager? = null
    private var registrationListener: NsdManager.RegistrationListener? = null
    private var discoveryListener: NsdManager.DiscoveryListener? = null
    private var multicastLock: WifiManager.MulticastLock? = null
    private val peers = ConcurrentHashMap<String, JSObject>()

    companion object {
        private const val TAG = "CafeMeshDiscovery"
        private const val SERVICE_TYPE = "_chhaon-ops._tcp."
    }

    @PluginMethod
    fun start(call: PluginCall) {
        val serviceName = call.getString("serviceName") ?: "chhaon-ops"
        val deviceId = call.getString("deviceId") ?: ""
        val deviceName = call.getString("deviceName") ?: "Device"
        val signalPort = call.getInt("signalPort") ?: 8765

        val ctx = context.applicationContext
        nsdManager = ctx.getSystemService(Context.NSD_SERVICE) as NsdManager

        val wifi = ctx.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        multicastLock = wifi.createMulticastLock("chhaon-mesh")
        multicastLock?.setReferenceCounted(true)
        multicastLock?.acquire()

        val serviceInfo = NsdServiceInfo().apply {
            setServiceName(serviceName)
            setServiceType(SERVICE_TYPE)
            port = signalPort
            setAttribute("deviceId", deviceId)
            setAttribute("deviceName", deviceName)
            setAttribute("signalPort", signalPort.toString())
        }

        registrationListener = object : NsdManager.RegistrationListener {
            override fun onServiceRegistered(info: NsdServiceInfo) {
                call.resolve()
            }
            override fun onRegistrationFailed(s: NsdServiceInfo?, code: Int) {
                call.reject("Registration failed: $code")
            }
            override fun onServiceUnregistered(s: NsdServiceInfo?) {}
            override fun onUnregistrationFailed(s: NsdServiceInfo?, code: Int) {}
        }
        nsdManager?.registerService(serviceInfo, NsdManager.PROTOCOL_DNS_SD, registrationListener)

        discoveryListener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(type: String) {}
            override fun onDiscoveryStopped(type: String) {}
            override fun onStartDiscoveryFailed(type: String, code: Int) {
                Log.w(TAG, "Discovery start failed: $code")
            }
            override fun onStopDiscoveryFailed(type: String, code: Int) {}
            override fun onServiceFound(info: NsdServiceInfo) {
                if (info.serviceName == serviceName) return
                nsdManager?.resolveService(info, object : NsdManager.ResolveListener {
                    override fun onResolveFailed(si: NsdServiceInfo?, code: Int) {}
                    override fun onServiceResolved(resolved: NsdServiceInfo) {
                        val attrs = resolved.attributes
                        val peerId = attrs["deviceId"]?.toString(Charsets.UTF_8) ?: return
                        val peer = JSObject().apply {
                            put("deviceId", peerId)
                            put("deviceName", attrs["deviceName"]?.toString(Charsets.UTF_8) ?: peerId)
                            put("host", resolved.host?.hostAddress ?: "")
                            put("port", resolved.port)
                            put("signalPort", attrs["signalPort"]?.toString(Charsets.UTF_8)?.toIntOrNull() ?: resolved.port)
                        }
                        peers[peerId] = peer
                        notifyListeners("peerFound", peer)
                    }
                })
            }
            override fun onServiceLost(info: NsdServiceInfo) {
                val lost = peers.entries.find { it.value.getString("deviceName") == info.serviceName }
                if (lost != null) {
                    peers.remove(lost.key)
                    val obj = JSObject().put("deviceId", lost.key)
                    notifyListeners("peerLost", obj)
                }
            }
        }
        nsdManager?.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discoveryListener)
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        try {
            registrationListener?.let { nsdManager?.unregisterService(it) }
            discoveryListener?.let { nsdManager?.stopServiceDiscovery(it) }
        } catch (e: Exception) {
            Log.w(TAG, "stop error", e)
        }
        multicastLock?.release()
        peers.clear()
        call.resolve()
    }

    @PluginMethod
    fun getPeers(call: PluginCall) {
        val arr = com.getcapacitor.JSArray()
        peers.values.forEach { arr.put(it) }
        call.resolve(JSObject().put("peers", arr))
    }
}
