import Foundation
import Network
import Capacitor

@objc(CafeMeshDiscoveryPlugin)
public class CafeMeshDiscoveryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CafeMeshDiscoveryPlugin"
    public let jsName = "CafeMeshDiscovery"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPeers", returnType: CAPPluginReturnPromise),
    ]

    private var browser: NWBrowser?
    private var listener: NWListener?
    private var peers: [String: [String: Any]] = [:]

    @objc func start(_ call: CAPPluginCall) {
        let serviceName = call.getString("serviceName") ?? "chhaon-ops"
        let signalPort = call.getInt("signalPort") ?? 8765

        browser?.cancel()
        listener?.cancel()
        browser = nil
        listener = nil
        peers.removeAll()

        do {
            let params = NWParameters.tcp
            params.includePeerToPeer = true
            listener = try NWListener(using: params)
            listener?.service = NWListener.Service(name: serviceName, type: "_chhaon-ops._tcp")
            listener?.stateUpdateHandler = { _ in }
            listener?.newConnectionHandler = { _ in }
            listener?.start(queue: .main)

            browser = NWBrowser(for: .bonjour(type: "_chhaon-ops._tcp", domain: nil), using: params)
            browser?.browseResultsChangedHandler = { [weak self] results, _ in
                guard let self = self else { return }
                for case .service(let name, _, _, _) in results {
                    if name == serviceName { continue }
                    let peer: [String: Any] = [
                        "deviceId": name,
                        "deviceName": name,
                        "host": "local",
                        "port": signalPort,
                        "signalPort": signalPort,
                    ]
                    self.peers[name] = peer
                    self.notifyListeners("peerFound", data: peer)
                }
            }
            browser?.start(queue: .main)
            call.resolve()
        } catch {
            call.reject("mDNS start failed: \(error.localizedDescription)")
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        browser?.cancel()
        listener?.cancel()
        browser = nil
        listener = nil
        peers.removeAll()
        call.resolve()
    }

    @objc func getPeers(_ call: CAPPluginCall) {
        call.resolve(["peers": Array(peers.values)])
    }
}
