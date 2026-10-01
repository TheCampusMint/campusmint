import Foundation
import CampusMintCore

func cryptographicNonceHasEntropyAndUsesURLAlphabet() throws {
    let nonces = try (0..<100).map { _ in try NativeSecurity.randomNonce() }
    try expect(Set(nonces).count == 100)
    try expect(nonces.allSatisfy { $0.count == 43 && $0.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" } })
}

func assertionBindsUserMethodPathAndExactBody() throws {
    let challenge = UUID(uuidString: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA")!
    let user = UUID(uuidString: "BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB")!
    let hash = NativeSecurity.sha256(Data("{}".utf8))
    try expect(hash == "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a")
    let bytes = try NativeSecurity.assertionData(challengeID: challenge, challenge: "serverNonce", userID: user, method: "POST", path: "/api/mintz", bodyHash: hash)
    try expect(String(data: bytes, encoding: .utf8) == "campusmint/v1\naaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\nserverNonce\nbbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb\nPOST\n/api/mintz\n\(hash)")
    let changed = try NativeSecurity.assertionData(challengeID: challenge, challenge: "serverNonce", userID: user, method: "DELETE", path: "/api/mintz", bodyHash: hash)
    try expect(NativeSecurity.sha256(bytes) != NativeSecurity.sha256(changed))
    try expectThrows( CampusError.invalidResponse) {
        try NativeSecurity.assertionData(challengeID: challenge, challenge: "line\ninjection", userID: user, method: "POST", path: "/api/mintz", bodyHash: hash)
    }
}
