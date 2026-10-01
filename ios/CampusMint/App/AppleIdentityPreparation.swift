import AuthenticationServices
import CampusMintCore
import Foundation

/// Not exposed in the UI until the backend can guarantee explicit linking without email auto-merge.
/// The caller must already be an authenticated, verified Student. Do not call signInWithIdToken here.
@MainActor
enum AppleIdentityPreparation {
    static func makeLinkRequest(for user: CampusUser) throws -> (request: ASAuthorizationAppleIDRequest, rawNonce: String) {
        guard user.account.accountType == "student", user.account.verifiedStudent,
              user.profile.accountId == user.id else { throw CampusError.unsupportedAccount }
        let nonce = try NativeSecurity.randomNonce()
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = []
        request.nonce = NativeSecurity.sha256(Data(nonce.utf8))
        // Apple's stable subject must be verified server-side and linked to user.id; no email matching.
        return (request, nonce)
    }
}
