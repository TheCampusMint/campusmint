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
    public init(action: String, target: UUID? = nil, body: String? = nil, requestID: UUID? = nil,
                enabled: Bool? = nil, parentID: UUID? = nil, replyTo: UUID? = nil) {
        self.action = action; self.target = target; self.body = body; self.requestId = requestID
        self.enabled = enabled; self.parentId = parentID; self.replyTo = replyTo
    }
}
