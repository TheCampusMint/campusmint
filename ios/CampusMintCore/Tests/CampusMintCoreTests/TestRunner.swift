import Foundation
import CampusMintCore

struct CheckFailure: Error { let description: String }
func expect(_ value: Bool, file: StaticString = #filePath, line: UInt = #line) throws {
    if !value { throw CheckFailure(description: "Check failed at \(file):\(line)") }
}
func require<Value>(_ value: Value?, file: StaticString = #filePath, line: UInt = #line) throws -> Value {
    guard let value else { throw CheckFailure(description: "Missing value at \(file):\(line)") }
    return value
}
func expectThrows<Value>(_ expected: CampusError, _ body: () throws -> Value) throws {
    do { _ = try body() } catch let error as CampusError {
        try expect(error == expected); return
    }
    throw CheckFailure(description: "Expected \(expected)")
}
func expectThrows<Value>(_ expected: CampusError, _ body: () async throws -> Value) async throws {
    do { _ = try await body() } catch let error as CampusError {
        try expect(error == expected); return
    }
    throw CheckFailure(description: "Expected \(expected)")
}

@main struct NativeChecks {
    static func main() async throws {
        try rejectsInsecureAndCredentialBearingServerURLs()
        try await restoresCanonicalIdentityUsingBearerWithoutCookies()
        try await rejectsProfileIdentitySwitch()
        try await refreshNeverChangesCanonicalAccount()
        try await revokedRefreshTokenErasesSession()
        try await transientRefreshFailureRetainsSessionForRetry()
        try await unauthorizedFeedErasesSession()
        try await expiredSessionRefreshesAndPersistsRotatedTokens()
        try await signOutErasesKeychainEvenIfNetworkFails()
        try postIsPublicPermanentAndRetryIDIsStable()
        try await noImplicitNativeSignupOrClientIdentityFields()
        try cryptographicNonceHasEntropyAndUsesURLAlphabet()
        try assertionBindsUserMethodPathAndExactBody()
        print("13 native security and contract checks passed.")
    }
}
