import Foundation
import CryptoKit
import Security

public enum NativeSecurity {
    public static func sha256(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    /// Use system randomness; this nonce is not a new account identity or a client secret.
    public static func randomNonce() throws -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        guard status == errSecSuccess else { throw KeychainFailure(status: status) }
        return Data(bytes).base64EncodedString().replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }

    public static func assertionData(challengeID: UUID, challenge: String, userID: UUID,
                                     method: String, path: String, bodyHash: String) throws -> Data {
        guard ["POST", "PATCH", "DELETE"].contains(method),
              path.hasPrefix("/api/"), !path.contains("\n"), !challenge.contains("\n"),
              !challenge.isEmpty, bodyHash.count == 64,
              bodyHash.allSatisfy({ "0123456789abcdef".contains($0) }) else { throw CampusError.invalidResponse }
        return Data("campusmint/v1\n\(challengeID.uuidString.lowercased())\n\(challenge)\n\(userID.uuidString.lowercased())\n\(method)\n\(path)\n\(bodyHash)".utf8)
    }
}
