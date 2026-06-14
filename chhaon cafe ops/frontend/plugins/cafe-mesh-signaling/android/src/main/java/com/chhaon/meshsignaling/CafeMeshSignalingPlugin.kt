package com.chhaon.meshsignaling

import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import okhttp3.*
import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import org.json.JSONObject
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.util.concurrent.ConcurrentHashMap

class MeshSignalingServer(
    port: Int,
    private val onMessage: (JSONObject) -> Unit
) : WebSocketServer(InetSocketAddress(port)) {

    private val sockets = ConcurrentHashMap<String, WebSocket>()

    override fun onOpen(conn: WebSocket, handshake: ClientHandshake) {}

    override fun onClose(conn: WebSocket, code: Int, reason: String, remote: Boolean) {
        sockets.entries.removeIf { it.value == conn }
    }

    override fun onMessage(conn: WebSocket, message: String) {
        try {
            val msg = JSONObject(message)
            if (msg.optString("type") == "hello") {
                val id = msg.optString("deviceId")
                if (id.isNotEmpty()) sockets[id] = conn
                return
            }
            onMessage(msg)
            val to = msg.optString("toDeviceId")
            val payload = message
            if (to == "*") {
                broadcast(payload)
            } else {
                sockets[to]?.send(payload)
            }
        } catch (e: Exception) {
            Log.w("MeshSignalingServer", "msg error", e)
        }
    }

    override fun onError(conn: WebSocket?, ex: Exception) {
        Log.w("MeshSignalingServer", "error", ex)
    }

    override fun onStart() {
        Log.i("MeshSignalingServer", "started on $port")
    }

    fun broadcast(text: String) {
        connections.forEach { it.send(text) }
    }

    companion object {
        fun getLocalIp(): String {
            try {
                val interfaces = NetworkInterface.getNetworkInterfaces()
                while (interfaces.hasMoreElements()) {
                    val ni = interfaces.nextElement()
                    val addrs = ni.inetAddresses
                    while (addrs.hasMoreElements()) {
                        val a = addrs.nextElement()
                        if (!a.isLoopbackAddress && a.hostAddress?.contains(':') == false) {
                            return a.hostAddress ?: "127.0.0.1"
                        }
                    }
                }
            } catch (_: Exception) {}
            return "127.0.0.1"
        }
    }
}

@CapacitorPlugin(name = "CafeMeshSignaling")
class CafeMeshSignalingPlugin : Plugin() {

    private var server: MeshSignalingServer? = null
    private var wsClient: WebSocket? = null
    private var deviceId: String = ""
    private val httpClient = OkHttpClient.Builder().build()

    @PluginMethod
    fun startServer(call: PluginCall) {
        deviceId = call.getString("deviceId") ?: ""
        val port = call.getInt("port") ?: 8765
        try {
            server?.stop()
            server = MeshSignalingServer(port) { msg ->
                val obj = JSObject()
                obj.put("fromDeviceId", msg.optString("fromDeviceId"))
                obj.put("toDeviceId", msg.optString("toDeviceId"))
                obj.put("type", msg.optString("type"))
                obj.put("payload", msg.optString("payload"))
                notifyListeners("signal", obj)
            }
            server?.start()
            val host = MeshSignalingServer.getLocalIp()
            val ret = JSObject().put("host", host).put("port", port)
            notifyListeners("serverReady", ret)
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject(e.message)
        }
    }

    @PluginMethod
    fun stopServer(call: PluginCall) {
        try { server?.stop() } catch (_: Exception) {}
        server = null
        call.resolve()
    }

    @PluginMethod
    fun connect(call: PluginCall) {
        deviceId = call.getString("deviceId") ?: ""
        val host = call.getString("host") ?: ""
        val port = call.getInt("port") ?: 8765
        val req = Request.Builder().url("ws://$host:$port").build()
        httpClient.newWebSocket(req, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                wsClient = webSocket
                webSocket.send(JSONObject().put("type", "hello").put("deviceId", deviceId).toString())
                call.resolve()
            }
            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val msg = JSONObject(text)
                    val obj = JSObject()
                    obj.put("fromDeviceId", msg.optString("fromDeviceId", msg.optString("deviceId")))
                    obj.put("toDeviceId", msg.optString("toDeviceId", deviceId))
                    obj.put("type", msg.optString("type"))
                    obj.put("payload", msg.optString("payload"))
                    notifyListeners("signal", obj)
                } catch (_: Exception) {}
            }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.w("CafeMeshSignaling", "connect failed", t)
                call.reject(t.message)
            }
        })
    }

    @PluginMethod
    fun disconnect(call: PluginCall) {
        wsClient?.close(1000, "bye")
        wsClient = null
        call.resolve()
    }

    @PluginMethod
    fun sendSignal(call: PluginCall) {
        val to = call.getString("toDeviceId") ?: "*"
        val type = call.getString("type") ?: ""
        val payload = call.getString("payload") ?: ""
        val msg = JSONObject()
            .put("fromDeviceId", deviceId)
            .put("toDeviceId", to)
            .put("type", type)
            .put("payload", payload)
            .toString()
        if (server != null) {
            server?.broadcast(msg)
        } else {
            wsClient?.send(msg)
        }
        call.resolve()
    }
}
