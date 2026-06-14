import Foundation
import Network
import Capacitor

@objc(CafeMeshSignalingPlugin)
public class CafeMeshSignalingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CafeMeshSignalingPlugin"
    public let jsName = "CafeMeshSignaling"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startServer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopServer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sendSignal", returnType: CAPPluginReturnPromise),
    ]

    private var listener: NWListener?
    private var connections: [NWConnection] = []
    private var outbound: NWConnection?
    private var deviceId = ""

    @objc func startServer(_ call: CAPPluginCall) {
        deviceId = call.getString("deviceId") ?? ""
        let port = UInt16(call.getInt("port") ?? 8765)
        stopServer(call)
        do {
            let params = NWParameters.tcp
            params.allowLocalEndpointReuse = true
            listener = try NWListener(using: params, on: NWEndpoint.Port(rawValue: port)!)
            listener?.newConnectionHandler = { [weak self] conn in
                conn.start(queue: .main)
                self?.connections.append(conn)
                self?.receive(on: conn)
            }
            listener?.start(queue: .main)
            let host = Self.localIp()
            let ret: [String: Any] = ["host": host, "port": port]
            notifyListeners("serverReady", data: ret)
            call.resolve(ret)
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func stopServer(_ call: CAPPluginCall) {
        listener?.cancel()
        listener = nil
        connections.forEach { $0.cancel() }
        connections.removeAll()
        call.resolve()
    }

    @objc func connect(_ call: CAPPluginCall) {
        deviceId = call.getString("deviceId") ?? ""
        let host = NWEndpoint.Host(call.getString("host") ?? "127.0.0.1")
        let port = NWEndpoint.Port(rawValue: UInt16(call.getInt("port") ?? 8765))!
        outbound = NWConnection(host: host, port: port, using: .tcp)
        outbound?.stateUpdateHandler = { [weak self] state in
            if case .ready = state {
                self?.sendRaw(self?.outbound, text: "{\"type\":\"hello\",\"deviceId\":\"\(self?.deviceId ?? "")\"}")
                call.resolve()
            }
        }
        outbound?.start(queue: .main)
        receive(on: outbound)
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        outbound?.cancel()
        outbound = nil
        call.resolve()
    }

    @objc func sendSignal(_ call: CAPPluginCall) {
        let to = call.getString("toDeviceId") ?? "*"
        let type = call.getString("type") ?? ""
        let payload = call.getString("payload") ?? ""
        let msg = "{\"fromDeviceId\":\"\(deviceId)\",\"toDeviceId\":\"\(to)\",\"type\":\"\(type)\",\"payload\":\(payload.jsonEscaped())}"
        if listener != nil {
            connections.forEach { sendRaw($0, text: msg) }
        } else {
            sendRaw(outbound, text: msg)
        }
        call.resolve()
    }

    private func receive(on conn: NWConnection?) {
        conn?.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, _, _ in
            guard let self = self, let data = data, let text = String(data: data, encoding: .utf8) else { return }
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                self.notifyListeners("signal", data: json)
            }
            self.receive(on: conn)
        }
    }

    private func sendRaw(_ conn: NWConnection?, text: String) {
        guard let data = text.data(using: .utf8) else { return }
        conn?.send(content: data, completion: .contentProcessed { _ in })
    }

    private static func localIp() -> String {
        var addr = "127.0.0.1"
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return addr }
        defer { freeifaddrs(ifaddr) }
        for ptr in sequence(first: first, next: { $0.pointee.ifa_next }) {
            let interface = ptr.pointee
            let family = interface.ifa_addr.pointee.sa_family
            if family == UInt8(AF_INET) {
                let name = String(cString: interface.ifa_name)
                if name == "en0" {
                    var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                    getnameinfo(interface.ifa_addr, socklen_t(interface.ifa_addr.pointee.sa_len), &hostname, socklen_t(hostname.count), nil, 0, NI_NUMERICHOST)
                    addr = String(cString: hostname)
                }
            }
        }
        return addr
    }
}

private extension String {
    func jsonEscaped() -> String {
        if let data = try? JSONEncoder().encode(self), let s = String(data: data, encoding: .utf8) { return s }
        return "\"\""
    }
}
