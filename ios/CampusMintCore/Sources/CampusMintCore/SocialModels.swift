import Foundation

public protocol SocialRow: Decodable, Sendable, Identifiable where ID == UUID {
    var pageDate: String { get }
}

public struct SocialCursor: Sendable {
    public let date: String
    public let id: UUID
    public init(date: String, id: UUID) { self.date = date; self.id = id }
}

public struct SocialPage<Row: Decodable & Sendable>: Decodable, Sendable {
    public let ok: Bool
    public let items: [Row]
    public let hasMore: Bool
}

public struct SocialMessage: SocialRow {
    public var pageDate: String { created_at }
    public let id: UUID
    public let conversation_id: UUID
    public let sender_id: UUID
    public let body: String
    public let reply_to_message_id: UUID?
    public let created_at: String
    public let delivered_at: String?
    public let seen_at: String?
    public var status: String { seen_at != nil ? "Seen" : delivered_at != nil ? "Delivered" : "Sent" }
}

public struct SocialConversation: SocialRow {
    public var pageDate: String { updated_at }
    public let id: UUID
    public let user_a: UUID
    public let user_b: UUID
    public let display_name: String
    public let username: String
    public let updated_at: String
    public let pinned: Bool
    public let unread: Int
    public let last_message: SocialMessage?
    public func peer(for user: UUID) -> UUID { user_a == user ? user_b : user_a }
}

public struct SocialComment: SocialRow {
    public var pageDate: String { created_at }
    public let id: UUID
    public let author_id: UUID
    public let body: String
    public let parent_comment_id: UUID?
    public let created_at: String
    public let display_name: String
    public let username: String
    public let liked: Bool
    public let like_count: Int
}

public struct SocialNotification: SocialRow {
    public var pageDate: String { created_at }
    public let id: UUID
    public let actor_id: UUID?
    public let kind: String
    public let payload: Payload?
    public struct Payload: Decodable, Sendable {
        public let organizationId: String?; public let eventId: String?
    }
    public var destination: NotificationDestination? {
        if kind == "private_message", let actor_id { return .message(actor_id) }
        if ["person_follow", "follow_request", "follow_request_accepted", "follow_request_declined"].contains(kind), let actor_id { return .profile(actor_id) }
        if ["club_invite", "club_announcement", "group_request_accepted", "group_request_denied"].contains(kind), let value = payload?.organizationId, let id = UUID(uuidString: value) { return .club(id) }
        if ["event_invite", "event_update"].contains(kind), let value = payload?.eventId, let id = UUID(uuidString: value) { return .event(id) }
        return nil
    }
    public let display_name: String?
    public let created_at: String
    public let read_at: String?
    public var title: String {
        switch kind {
        case "private_message": "\(display_name ?? "Someone") sent you a message"
        case "person_follow": "\(display_name ?? "Someone") followed you"
        case "club_invite": "Club invitation"
        case "group_request_accepted": "Club request accepted"
        case "event_invite": "Event invitation"
        case "event_update": "Event update"
        case "club_announcement": "Club update"
        case "group_request_denied": "Club request declined"
        case "follow_request": "\(display_name ?? "Someone") requested to connect"
        case "follow_request_accepted": "\(display_name ?? "Someone") accepted your request"
        case "follow_request_declined": "Connection request declined"
        default: "Campus update"
        }
    }
}

public struct SocialMutation: Encodable, Sendable {
    public let action: String
    public let target: UUID?
    public let body: String?
    public let requestId: UUID?
    public let enabled: Bool?
    public let parentId: UUID?
    public let replyTo: UUID?
    public let channel: String?
    public let website: String?
    public init(action: String, target: UUID? = nil, body: String? = nil, requestID: UUID? = nil,
                enabled: Bool? = nil, parentID: UUID? = nil, replyTo: UUID? = nil, channel: String? = nil, website: String? = nil) {
        self.action = action; self.target = target; self.body = body; self.requestId = requestID
        self.enabled = enabled; self.parentId = parentID; self.replyTo = replyTo; self.channel = channel; self.website = website
    }
}

public enum SocialDetail: String, Sendable { case post, people, profile, following, blocked, saved, note, attendance }
public struct SocialPerson: Codable, Sendable, Identifiable, Equatable {
    public let id: UUID; public let name: String; public let username: String; public let campus: String
    public let bio: String?; public let major: String?
    public let following: Bool; public let canMessage: Bool; public let canFollow: Bool
}
public struct SocialDirectory: Decodable, Sendable { public let items: [SocialPerson]; public let hasMore: Bool }
public struct PostInteractions: Decodable, Sendable, Equatable { public let appreciated: Bool; public let endorsed: Bool; public let saved: Bool; public let commentCount: Int?; public let commentsEnabled: Bool? }
public struct SavedPosts: Decodable, Sendable {
    public struct Item: Decodable, Sendable, Identifiable { public let id: UUID }
    public let items: [Item]; public let hasMore: Bool
}
public struct SocialNote: Decodable, Sendable {
    public struct Note: Decodable, Sendable { public let body: String?; public let website: String?; public let expiresAt: String }
    public let note: Note?
}
public struct EventAttendance: Decodable, Sendable { public let attending: Bool }
public struct PostMention: Codable, Sendable, Equatable, Identifiable {
    public var id: UUID { userId }; public let userId: UUID; public let username: String
    public init(userId: UUID, username: String) { self.userId = userId; self.username = username }
    public static func resolve(_ people: [Self], caption: String) -> [Self] {
        Array(people.filter { person in
            let token = "@" + NSRegularExpression.escapedPattern(for: person.username)
            return caption.range(of: "(?<![A-Za-z0-9_.])" + token + "(?![A-Za-z0-9_.])", options: [.regularExpression, .caseInsensitive]) != nil
        }.prefix(30))
    }
}

public enum NotificationDestination: Sendable, Equatable { case message(UUID), profile(UUID), club(UUID), event(UUID) }
