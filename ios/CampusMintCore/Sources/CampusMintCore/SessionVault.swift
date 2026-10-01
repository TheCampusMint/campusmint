import Foundation
import Security

public protocol SessionVault: Sendable {
    func load() async throws -> NativeSession?
    func save(_ session: NativeSession) async throws
    func clear() async throws
}

/// Tokens stay in non-synchronizing, device-only Keychain items. Preferences never contain secrets.
public actor KeychainSessionVault: SessionVault {
    private let service: String
    private let account = "supabase-session-v1"
    public init(service: String) { self.service = service }

    private var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service, kSecAttrAccount as String: account,
         kSecAttrSynchronizable as String: false]
    }

    public func load() throws -> NativeSession? {
        var lookup = query
        lookup[kSecReturnData as String] = true
        lookup[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(lookup as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = item as? Data else { throw KeychainFailure(status: status) }
        let session = try JSONDecoder().decode(NativeSession.self, from: data)
        try session.validate()
        return session
    }

    public func save(_ session: NativeSession) throws {
        try session.validate()
        let data = try JSONEncoder().encode(session)
        let attributes: [String: Any] = [kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var insertion = query
            attributes.forEach { insertion[$0.key] = $0.value }
            let result = SecItemAdd(insertion as CFDictionary, nil)
            guard result == errSecSuccess else { throw KeychainFailure(status: result) }
        } else if status != errSecSuccess { throw KeychainFailure(status: status) }
    }

    public func clear() throws {
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw KeychainFailure(status: status) }
    }
}

public struct KeychainFailure: LocalizedError, Sendable {
    public let status: OSStatus
    public var errorDescription: String? { "Secure storage is unavailable. Unlock your device and try again." }
}
