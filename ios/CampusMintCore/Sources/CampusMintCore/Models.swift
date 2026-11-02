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
    public let authUserId: UUID?
    public let studentSetup: NativeStudentSetup?
    public let studentSmsVerificationRequired: Bool?
    public let canUseCampusTester: Bool?
    public let creator: NativeCreatorStatus?
    public let user: CampusUser?
    public let message: String?
}

public struct CampusUser: Decodable, Sendable, Identifiable {
    public var id: UUID { account.id }
    public let account: CampusAccount
    public let profile: CampusProfile
    public let privacy: [String: String]?
    public let socialSettings: [String: String]?
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
    public let academicArea: String?; public let graduationYear: Int?; public let hometown: String?
    public let interests: [String]?; public let hobbies: [String]?; public let sportsInterests: [String]?
    public let lookingForRoommate: Bool?; public let roommatePreferences: [String]?
    public let offersTutoring: Bool?; public let tutoringSubjects: [String]?
    public let instagram: String?; public let linkedin: String?; public let portfolioUrl: String?; public let personalWebsite: String?
}

public struct MintFeedResponse: Decodable, Sendable {
    public let ok: Bool
    public let mintz: [MintPost]
    public let authors: [CampusUser]
    public let nextCursor: String?
}

public struct MintPost: Decodable, Sendable, Identifiable {
    public let id: String
    public let authorId: UUID
    public let caption: String
    public let createdAt: String
    public let media: [MintMedia]
    public let poll: MintPoll?
    public let viewCount: Int?
    public let commentCount: Int?
    public let commentsEnabled: Bool?
    public let taggedOrganizations: [OrganizationTag]?
    public let eventData: EventContext?
    public struct OrganizationTag: Decodable, Sendable, Identifiable { public let id: String; public let name: String }
    public struct EventContext: Decodable, Sendable { public let eventId: String?; public let title: String; public let locationDetails: String? }
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
    public let selectedOptionId: String?
    public struct Option: Decodable, Sendable, Identifiable {
        public let id: String
        public let label: String
        public let voteCount: Int
    }
}

public struct NativeConfig: Decodable, Sendable {
    public let storageURL: String?
    public let realtime: SocialRealtimeConfiguration?
    public let apiVersion: Int
    public let appleLinkingEnabled: Bool
    public let appAttestEnabled: Bool
    public let appAttestRequired: Bool
}

public enum CampusError: LocalizedError, Sendable, Equatable {
    case configuration, invalidSession, identityMismatch, signedOut, unsupportedAccount
    case server(Int, String), invalidResponse, emptyPost, featureUnavailable
    case invalidPost(String)

    public var errorDescription: String? {
        switch self {
        case .configuration: "The app’s secure server address needs configuration."
        case .invalidSession, .signedOut: "Sign in again to continue."
        case .identityMismatch: "Your session could not be verified. Sign in again."
        case .unsupportedAccount: "Finish Student account setup on the website."
        case .server(_, let message): message
        case .invalidResponse: "Campus Mint returned an unexpected response."
        case .emptyPost: "Add text, media or a poll."
        case .invalidPost(let message): message
        case .featureUnavailable: "This feature is not available yet."
        }
    }
}

public enum PostPrivacy: String, CaseIterable, Codable, Sendable {
    case `public`, connections, `private`
    public var label: String { switch self { case .public: "Public"; case .connections: "Connections"; case .private: "Only me" } }
}

public struct TextPostRequest: Encodable, Sendable {
    public let action = "publish"
    public let payload: Payload
    public init(caption: String, requestID: UUID = UUID(), privacy: PostPrivacy = .public, expiresAt: String? = nil, poll: PollInput? = nil, media: [UploadMedia] = [], context: PostContext? = nil, mentions: [PostMention] = [], commentsEnabled: Bool = true) throws {
        let text = caption.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty || poll != nil || !media.isEmpty else { throw CampusError.emptyPost }
        guard text.utf16.count <= 10_000 else { throw CampusError.invalidPost("Keep the post under 10,000 characters.") }
        try UploadMedia.validate(media)
        let context = try context?.validated()
        let isEvent = context?.kind == .event
        if isEvent && expiresAt == nil { throw CampusError.invalidPost("Event posts last 24 hours.") }
        let location = isEvent && context?.eventID == nil ? context.map { PostLocation(label: $0.location) } : nil
        payload = Payload(requestId: requestID.uuidString.lowercased(), caption: text, postType: isEvent ? "event" : "personal", privacy: privacy, expiresAt: expiresAt, commentsEnabled: commentsEnabled, hashtags: CaptionTags.hashtags(text), mentions: PostMention.resolve(mentions, caption: text), taggedOrganizationIds: context?.kind == .club ? [context!.clubID!.uuidString.lowercased()] : [], eventData: isEvent ? PostEvent(eventId: context?.eventID, title: String(text.prefix(120)), location: location, timeZone: TimeZone.current.identifier) : nil, location: location, poll: try poll?.validated(), mediaMetadata: media.map { .init(width: $0.width, height: $0.height, durationSeconds: $0.durationSeconds) })
    }
    public struct Payload: Encodable, Sendable {
        public let requestId: String
        public let caption: String
        public let postType: String
        public let privacy: PostPrivacy
        public let expiresAt: String?
        public let commentsEnabled: Bool
        public let organizationAudience = "public"
        public let hashtags: [String]
        public let mentions: [PostMention]
        public let taggedUserIds: [String] = []
        public let taggedOrganizationIds: [String]
        public let eventData: PostEvent?
        public let location: PostLocation?
        public let poll: PollInput?
        public let mediaMetadata: [Metadata]
    }
    public struct Metadata: Encodable, Sendable {
        public let width: Int
        public let height: Int
        public let durationSeconds: Double?
    }
}

public struct NativeStudentSetup: Decodable, Sendable {
    public let universityId: String?
    public let sports: [Sport]
    public struct Sport: Decodable, Sendable, Identifiable { public let id: String; public let label: String }
}
public struct StudentSignup: Encodable, Sendable {
    public let accountType = "student"
    public let firstName: String; public let lastName: String; public let username: String; public let sportsInterests: [String]
    public init(firstName: String, lastName: String, username: String, sports: [String]) throws {
        let first = firstName.trimmingCharacters(in: .whitespacesAndNewlines), last = lastName.trimmingCharacters(in: .whitespacesAndNewlines), handle = username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !first.isEmpty, first.utf16.count <= 80, last.utf16.count <= 80,
              handle.range(of: "^[a-z0-9][a-z0-9._]{2,29}$", options: .regularExpression) != nil else { throw CampusError.invalidPost("Add your first name and a valid username.") }
        self.firstName = first; self.lastName = last; self.username = handle; sportsInterests = Array(Set(sports)).sorted()
    }
}
