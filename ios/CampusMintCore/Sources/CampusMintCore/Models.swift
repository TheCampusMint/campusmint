import Foundation

public struct NativeSession: Codable, Sendable, Equatable {
    public let accessToken: String
    public let refreshToken: String
    public let expiresAt: TimeInterval
    /// The existing auth.users.id. Never derive identity from email or username.
    public let userId: UUID

    public init(accessToken: String, refreshToken: String, expiresAt: TimeInterval, userId: UUID) {
        self.accessToken = accessToken; self.refreshToken = refreshToken
        self.expiresAt = expiresAt; self.userId = userId
    }

    public func validate(expectedUserID: UUID? = nil) throws {
        guard !accessToken.isEmpty, !refreshToken.isEmpty, expiresAt.isFinite, expiresAt > 0 else {
            throw CampusError.invalidSession
        }
        if let expectedUserID, userId != expectedUserID { throw CampusError.identityMismatch }
    }
}

public struct AccountResponse: Decodable, Sendable {
    public let ok: Bool
    public let authenticated: Bool?
    public let accountType: String?
    public let onboardingComplete: Bool?
    public let user: CampusUser?
    public let message: String?
}

public struct CampusUser: Decodable, Sendable, Identifiable {
    public var id: UUID { account.id }
    public let account: CampusAccount
    public let profile: CampusProfile
}

public struct CampusAccount: Decodable, Sendable {
    public let id: UUID
    public let accountType: String
    public let universityId: String
    public let verifiedStudent: Bool
    public let verifiedAlumni: Bool
}

public struct CampusProfile: Decodable, Sendable {
    public let accountId: UUID
    public let firstName: String
    public let lastName: String
    public let displayName: String
    public let username: String
    public let bio: String?
    public let major: String?
}

public struct MintFeedResponse: Decodable, Sendable {
    public let ok: Bool
    public let mintz: [MintPost]
    public let authors: [CampusUser]
}

public struct MintPost: Decodable, Sendable, Identifiable {
    public let id: String
    public let authorId: UUID
    public let caption: String
    public let createdAt: String
    public let media: [MintMedia]
    public let poll: MintPoll?
}

public struct MintMedia: Decodable, Sendable, Identifiable {
    public let id: String
    public let type: String
    public let url: String?
    public let width: Double?
    public let height: Double?
    public var secureURL: URL? {
        guard let url, let parsed = URL(string: url), parsed.scheme == "https", parsed.host != nil,
              parsed.user == nil, parsed.password == nil else { return nil }
        return parsed
    }
}

public struct MintPoll: Decodable, Sendable {
    public let question: String
    public let options: [Option]
    public let totalVotes: Int
    public struct Option: Decodable, Sendable, Identifiable {
        public let id: String
        public let label: String
        public let voteCount: Int
    }
}

public struct NativeConfig: Decodable, Sendable {
    public let apiVersion: Int
    public let appleLinkingEnabled: Bool
    public let appAttestEnabled: Bool
    public let appAttestRequired: Bool
}

public enum CampusError: LocalizedError, Sendable, Equatable {
    case configuration, invalidSession, identityMismatch, signedOut, unsupportedAccount
    case server(Int, String), invalidResponse, emptyPost, featureUnavailable

    public var errorDescription: String? {
        switch self {
        case .configuration: "The app’s secure server address needs configuration."
        case .invalidSession, .signedOut: "Sign in again to continue."
        case .identityMismatch: "Your session could not be verified. Sign in again."
        case .unsupportedAccount: "Finish Student account setup on the website."
        case .server(_, let message): message
        case .invalidResponse: "Campus Mint returned an unexpected response."
        case .emptyPost: "Add text before publishing."
        case .featureUnavailable: "This feature is not available yet."
        }
    }
}

public struct TextPostRequest: Encodable, Sendable {
    public let action = "publish"
    public let payload: Payload
    public init(caption: String, requestID: UUID = UUID()) throws {
        let text = caption.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { throw CampusError.emptyPost }
        payload = Payload(requestId: requestID.uuidString.lowercased(), caption: text)
    }
    public struct Payload: Encodable, Sendable {
        public let requestId: String
        public let caption: String
        public let postType = "personal"
        public let privacy = "public"
        public let expiresAt: String? = nil
        public let commentsEnabled = true
        public let organizationAudience = "public"
        public let hashtags: [String] = []
        public let mentions: [String] = []
        public let taggedUserIds: [String] = []
        public let taggedOrganizationIds: [String] = []
        public let mediaMetadata: [String] = []
    }
}
