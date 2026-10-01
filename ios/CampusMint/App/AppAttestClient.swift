import Foundation
import DeviceCheck
import CryptoKit
import Security
import CampusMintCore

/// App Attest provides device evidence only. The server still checks ownership and permissions.
@MainActor
final class AppAttestClient {
    private let service = DCAppAttestService.shared
    private let keychainService = "\(Bundle.main.bundleIdentifier ?? "com.campusmint.app").app-attest"

    func headers(api: CampusAPI, userID: UUID, method: String, path: String, body: Data) async throws -> [String: String] {
        guard service.isSupported else { throw CampusError.featureUnavailable }
        let keyID = try await registeredKey(api: api, userID: userID)
        let hash = NativeSecurity.sha256(body)
        let challenge: Challenge = try await api.authenticatedRequest("/api/native/attest/challenge", body: ChallengeRequest(purpose: "assert", keyId: keyID, method: method, path: path, bodyHash: hash))
        try challenge.validate()
        let clientData = try NativeSecurity.assertionData(challengeID: challenge.challengeId, challenge: challenge.challenge, userID: userID, method: method, path: path, bodyHash: hash)
        let assertion: Data
        do { assertion = try await service.generateAssertion(keyID, clientDataHash: Data(SHA256.hash(data: clientData))) }
        catch {
            // Device restore/reinstallation can leave a Keychain ID without its Secure Enclave key.
            if (error as? DCError)?.code == .invalidKey { try deleteKey(userID) }
            throw error
        }
        return ["X-App-Attest-Key-Id": keyID,
                "X-App-Attest-Challenge-Id": challenge.challengeId.uuidString.lowercased(),
                "X-App-Attest-Assertion": assertion.base64EncodedString()]
    }

    private func registeredKey(api: CampusAPI, userID: UUID) async throws -> String {
        if let existing = try loadKey(userID), existing.registered { return existing.keyID }
        let keyID: String
        if let pending = try loadKey(userID) { keyID = pending.keyID }
        else {
            keyID = try await service.generateKey()
            try saveKey(KeyRecord(keyID: keyID, registered: false), userID)
        }
        do {
            let challenge: Challenge = try await api.authenticatedRequest("/api/native/attest/challenge", body: ChallengeRequest(purpose: "register", keyId: keyID))
            try challenge.validate()
            let attestation = try await service.attestKey(keyID, clientDataHash: Data(SHA256.hash(data: Data(challenge.challenge.utf8))))
            let result: Registration = try await api.authenticatedRequest("/api/native/attest/register", body: RegistrationRequest(challengeId: challenge.challengeId.uuidString.lowercased(), keyId: keyID, attestation: attestation.base64EncodedString()))
            guard result.ok else { throw CampusError.invalidResponse }
            try saveKey(KeyRecord(keyID: keyID, registered: true), userID)
            return keyID
        } catch {
            // Apple's transient failure can retry the same pending key; never silently skip verification.
            if (error as? DCError)?.code != .serverUnavailable { try deleteKey(userID) }
            throw error
        }
    }

    private func keyQuery(_ userID: UUID) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: keychainService,
         kSecAttrAccount as String: userID.uuidString.lowercased(),
         kSecAttrSynchronizable as String: false]
    }
    private func loadKey(_ userID: UUID) throws -> KeyRecord? {
        var query = keyQuery(userID)
        query[kSecReturnData as String] = true; query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = item as? Data else { throw CampusError.invalidSession }
        return try JSONDecoder().decode(KeyRecord.self, from: data)
    }
    private func saveKey(_ value: KeyRecord, _ userID: UUID) throws {
        let changes: [String: Any] = [kSecValueData as String: try JSONEncoder().encode(value),
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        let status = SecItemUpdate(keyQuery(userID) as CFDictionary, changes as CFDictionary)
        if status == errSecItemNotFound {
            var insertion = keyQuery(userID); changes.forEach { insertion[$0.key] = $0.value }
            guard SecItemAdd(insertion as CFDictionary, nil) == errSecSuccess else { throw CampusError.invalidSession }
        } else if status != errSecSuccess { throw CampusError.invalidSession }
    }
    private func deleteKey(_ userID: UUID) throws {
        let status = SecItemDelete(keyQuery(userID) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw CampusError.invalidSession }
    }
    private struct KeyRecord: Codable { let keyID: String; let registered: Bool }
    private struct ChallengeRequest: Encodable, Sendable {
        let purpose: String
        let keyId: String?
        var method: String? = nil
        var path: String? = nil
        var bodyHash: String? = nil
    }
    private struct Challenge: Decodable, Sendable {
        let ok: Bool
        let challengeId: UUID
        let challenge: String
        let expiresAt: String
        func validate() throws {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            guard ok, challenge.utf8.count >= 16, let expiry = formatter.date(from: expiresAt), expiry > Date() else { throw CampusError.invalidResponse }
        }
    }
    private struct RegistrationRequest: Encodable, Sendable {
        let challengeId: String; let keyId: String; let attestation: String
    }
    private struct Registration: Decodable, Sendable { let ok: Bool }
}
