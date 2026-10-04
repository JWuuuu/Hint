import Capacitor
import Security

@objc(HintDeviceCredentialPlugin)
public class HintDeviceCredentialPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HintDeviceCredentialPlugin"
    public let jsName = "HintDeviceCredential"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise)
    ]

    private func query(_ call: CAPPluginCall) -> [String: Any]? {
        guard let key = call.getString("key"), key.hasPrefix("hint_device_session_v1:"), key.count <= 1024 else {
            call.reject("Invalid credential key")
            return nil
        }
        return [kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: "com.mydailyhint.app.device-session",
                kSecAttrAccount as String: key,
                kSecAttrSynchronizable as String: false]
    }

    @objc public func read(_ call: CAPPluginCall) {
        guard var request = query(call) else { return }
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(request as CFDictionary, &item)
        if status == errSecItemNotFound { call.resolve(["value": NSNull()]); return }
        guard status == errSecSuccess, let data = item as? Data,
              let value = String(data: data, encoding: .utf8) else {
            call.reject("Device credential is temporarily unavailable")
            return
        }
        call.resolve(["value": value])
    }

    @objc public func write(_ call: CAPPluginCall) {
        guard let request = query(call) else { return }
        guard let value = call.getString("value"), let data = value.data(using: .utf8), data.count <= 4096 else {
            call.reject("Invalid device credential")
            return
        }
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        var status = SecItemUpdate(request as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            let item = request.merging(attributes) { _, new in new }
            status = SecItemAdd(item as CFDictionary, nil)
        }
        guard status == errSecSuccess else {
            call.reject("Device credential could not be saved")
            return
        }
        call.resolve()
    }
}
