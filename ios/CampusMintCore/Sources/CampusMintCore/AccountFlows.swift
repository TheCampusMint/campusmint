import Foundation

public enum CampusWrite: Sendable {
    case club, listing, listingStatus, marketplaceMessage, profile, privacy, preference, creatorApplication
    public var path: String { switch self {
    case .creatorApplication: "/api/creator/apply"
    case .club: "/api/clubs"
    case .listing, .listingStatus: "/api/marketplace"
    case .marketplaceMessage: "/api/marketplace/messages"
    case .profile: "/api/account/profile"
    case .privacy: "/api/account/privacy"
    case .preference: "/api/feed/preferences"
    } }
    public var method: String { switch self { case .profile, .privacy, .listingStatus: "PATCH"; default: "POST" } }
}
public struct CampusWriteResult: Decodable, Sendable { public let ok: Bool; public let id: UUID? }
public struct ClubPerson: Decodable, Sendable, Identifiable {
    public let id: UUID; public let name: String; public let username: String; public let role: String?
    public var roleLabel: String { switch role { case "leader": "Owner"; case "officer": "Admin"; case "requested": "Requested"; default: "Member" } }
}
public enum ClubAction: String, Codable, Sendable {
    case create, update, request, cancel, leave, approve, reject, remove, promote, demote, invite, accept_invite, decline_invite
}
public struct ClubChange: Encodable, Sendable {
    public let action: ClubAction; public let clubId: UUID?; public let targetId: UUID?
    public init(_ action: ClubAction, club: UUID? = nil, target: UUID? = nil) throws {
        guard action != .create && action != .update, club != nil else { throw CampusError.invalidPost("Choose a club.") }
        if [.approve, .reject, .remove, .promote, .demote, .invite].contains(action), target == nil { throw CampusError.invalidPost("Choose a person.") }
        self.action = action; clubId = club; targetId = target
    }
}
public struct ClubDraft: Encodable, Sendable {
    public var action: ClubAction = .create; public var clubId: UUID?
    public var name = "", handle = "", description = "", location = "", schedule = "", website = "", photo = ""
    public var visibility = "private", tags: [String] = []
    public init(club: CampusClub? = nil) {
        guard let club else { return }
        action = .update; clubId = UUID(uuidString: club.id); name = club.name; handle = club.handle
        description = club.description ?? ""; location = club.location ?? ""; schedule = club.schedule ?? ""
        website = club.website ?? ""; photo = club.photo ?? ""; visibility = club.visibility; tags = club.tags ?? []
    }
    public func validated() throws -> Self {
        var value = self
        value.name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        value.description = description.trimmingCharacters(in: .whitespacesAndNewlines)
        value.handle = handle.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard (2...160).contains(value.name.utf16.count), (2...5000).contains(value.description.utf16.count),
              ["private", "public"].contains(visibility), location.utf16.count <= 200, schedule.utf16.count <= 200 else { throw CampusError.invalidPost("Check the club name and description.") }
        if action == .create && value.handle.range(of: "^[a-z0-9][a-z0-9-]{2,63}$", options: .regularExpression) == nil { throw CampusError.invalidPost("Use 3–64 lowercase letters, numbers or hyphens for the handle.") }
        guard action == .create || (action == .update && clubId != nil) else { throw CampusError.invalidPost("Choose a club.") }
        for link in [website, photo] where !link.isEmpty {
            guard link.count <= 1000, let url = URL(string: link), url.scheme == "https", url.host != nil, url.user == nil, url.password == nil else { throw CampusError.invalidPost("Use an HTTPS link.") }
        }
        value.tags = Array(tags.map { String($0.trimmingCharacters(in: .whitespacesAndNewlines).prefix(40)) }.filter { !$0.isEmpty }.prefix(8))
        return value
    }
}
public struct CampusCoordinate: Codable, Sendable, Equatable {
    public let latitude: Double, longitude: Double
    public init(latitude: Double, longitude: Double) { self.latitude = latitude; self.longitude = longitude }
    public var valid: Bool { latitude.isFinite && longitude.isFinite && (-90...90).contains(latitude) && (-180...180).contains(longitude) }
}
public enum ListingCondition: String, CaseIterable, Codable, Sendable {
    case new = "New", likeNew = "Like New", used = "Good"
    public var label: String { switch self { case .new: "New"; case .likeNew: "Used – Like New"; case .used: "Used" } }
}
public struct ListingDraft: Encodable, Sendable {
    public var requestId = UUID(), title = "", brand = "", pickupArea = "", askingPrice: Double = 0
    public var condition: ListingCondition = .used
    public var shareNearbyArea = false
    public var nearbyLocation: CampusCoordinate?
    public init() {}
    public func validated() throws -> Self {
        var copy = self
        copy.title = title.trimmingCharacters(in: .whitespacesAndNewlines)
        copy.brand = brand.trimmingCharacters(in: .whitespacesAndNewlines)
        copy.pickupArea = pickupArea.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (2...100).contains(copy.title.utf16.count), copy.brand.utf16.count <= 80, (2...120).contains(copy.pickupArea.utf16.count) else { throw CampusError.invalidPost("Add an item name and meetup location.") }
        guard askingPrice.isFinite, (0...999999).contains(askingPrice), abs((askingPrice * 100).rounded() - askingPrice * 100) < 0.000001 else { throw CampusError.invalidPost("Enter a price with up to two decimal places.") }
        if shareNearbyArea { guard nearbyLocation?.valid == true else { throw CampusError.invalidPost("Choose a listing area.") } }
        else { copy.nearbyLocation = nil }
        return copy
    }
}
public struct ListingStatus: Encodable, Sendable {
    public let id: UUID, status: String
    public init(id: UUID, sold: Bool) { self.id = id; status = sold ? "sold" : "active" }
}
public struct MarketplaceMessages: Decodable, Sendable {
    public let messages: [MarketplaceMessage], buyers: [MarketplaceBuyer]
    public let listingStatus: String?
}
public struct MarketplaceBuyer: Decodable, Sendable, Identifiable {
    public var id: UUID { user_id }; public let user_id: UUID; public let first_name: String
}
public struct MarketplaceMessage: Decodable, Sendable, Identifiable {
    public let id: UUID, listing_id: UUID, buyer_id: UUID, sender_id: UUID
    public let body: String, created_at: String
}
public struct MarketplaceSend: Encodable, Sendable {
    public let listingId: UUID, requestId: UUID; public let buyerId: UUID?; public let body: String
    public init(listing: UUID, buyer: UUID?, body: String, request: UUID) throws {
        let text = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (1...2000).contains(text.utf16.count) else { throw CampusError.invalidPost("Write a message up to 2,000 characters.") }
        listingId = listing; buyerId = buyer; self.body = text; requestId = request
    }
}
public struct ProfileDraft: Encodable, Sendable {
    public var firstName: String, lastName: String, username: String, displayName: String, bio: String, major: String
    public var academicArea: String, hometown: String, instagram: String, linkedin: String, portfolioUrl: String, personalWebsite: String
    public var graduationYear: Int?
    public var interests: [String], hobbies: [String], sportsInterests: [String], roommatePreferences: [String], tutoringSubjects: [String]
    public var lookingForRoommate: Bool, offersTutoring: Bool
    public init(_ profile: CampusProfile) {
        firstName = profile.firstName; lastName = profile.lastName; username = profile.username; displayName = profile.displayName
        bio = profile.bio ?? ""; major = profile.major ?? ""; academicArea = profile.academicArea ?? ""; hometown = profile.hometown ?? ""
        instagram = profile.instagram ?? ""; linkedin = profile.linkedin ?? ""; portfolioUrl = profile.portfolioUrl ?? ""; personalWebsite = profile.personalWebsite ?? ""
        graduationYear = profile.graduationYear; interests = profile.interests ?? []; hobbies = profile.hobbies ?? []; sportsInterests = profile.sportsInterests ?? []
        roommatePreferences = profile.roommatePreferences ?? []; tutoringSubjects = profile.tutoringSubjects ?? []
        lookingForRoommate = profile.lookingForRoommate ?? false; offersTutoring = profile.offersTutoring ?? false
    }
    public func encoded() throws -> Data {
        guard !firstName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw CampusError.invalidPost("First name is required.") }
        if let graduationYear, !(1900...2200).contains(graduationYear) { throw CampusError.invalidPost("Check the graduation year.") }
        // Encode explicit null so clearing graduation year differs from omitting an unchanged field.
        let encoded = try JSONEncoder().encode(self)
        var object = try JSONSerialization.jsonObject(with: encoded) as! [String: Any]
        if graduationYear == nil { object["graduationYear"] = NSNull() }
        return try JSONSerialization.data(withJSONObject: object, options: .sortedKeys)
    }
}

public enum PlaceResource: Sendable { case details, reviews, photo(Int) }
public struct PlaceAttribution: Decodable, Sendable { public let name: String; public let url: String? }
public struct PlaceDetails: Decodable, Sendable {
    public let website: String?; public let phone: String?; public let hours: [String]; public let openNow: Bool?; public let attributions: [PlaceAttribution]
}
public struct PlaceReviews: Decodable, Sendable {
    public let reviews: [PlaceReview]; public let attributions: [PlaceAttribution]
}
public struct PlaceReview: Decodable, Sendable { public let author: String; public let authorUrl: String?; public let text: String; public let rating: Double; public let url: String? }
public struct PlacePhoto: Decodable, Sendable { public let url: String; public let authors: [PlaceAttribution]; public let sourceUrl: String? }
public struct PlacePhotoResponse: Decodable, Sendable { public let photo: PlacePhoto? }

public struct FeedPreferenceWrite: Encodable, Sendable {
    public struct Signal: Encodable, Sendable {
        public let mintId: UUID; public let weight: Double; public let reason: String?; public let updatedAt: String
        enum CodingKeys: String, CodingKey { case mintId, weight, reason, updatedAt }
        public func encode(to encoder: Encoder) throws { var c = encoder.container(keyedBy: CodingKeys.self); try c.encode(mintId, forKey: .mintId); try c.encode(weight, forKey: .weight); try c.encode(reason, forKey: .reason); try c.encode(updatedAt, forKey: .updatedAt) }
    }
    public let signals: [Signal]
    public init(post: UUID, weight: Double = 0, reason: String? = nil, now: Date = Date()) throws {
        guard weight.isFinite, (0...4).contains(weight), reason == nil || ["creator","content","relevance"].contains(reason!) else { throw CampusError.configuration }
        signals = [Signal(mintId: post, weight: weight, reason: reason, updatedAt: ISO8601DateFormatter().string(from: now))]
    }
}


public struct CreatorApplicationDraft: Encodable, Sendable {
    public var platform = "youtube", externalHandle = "", externalProfileUrl = "", applicationNotes = ""
    public var claimedFollowerCount = 0
    public init() {}
    public func validated() throws -> Self {
        var value = self
        value.externalHandle = externalHandle.trimmingCharacters(in: .whitespacesAndNewlines)
        value.externalProfileUrl = externalProfileUrl.trimmingCharacters(in: .whitespacesAndNewlines)
        value.applicationNotes = applicationNotes.trimmingCharacters(in: .whitespacesAndNewlines)
        guard ["youtube","instagram","tiktok","twitch","other"].contains(platform),
              !value.externalHandle.isEmpty, value.externalHandle.utf16.count <= 160,
              let url = URL(string: value.externalProfileUrl), url.scheme == "https", url.host != nil, url.user == nil, url.password == nil,
              value.externalProfileUrl.utf16.count <= 500, value.applicationNotes.utf16.count <= 2000,
              (0...9_007_199_254_740_991).contains(claimedFollowerCount)
        else { throw CampusError.invalidPost("Add a valid platform, handle, HTTPS profile link and follower count.") }
        return value
    }
}
public struct NativeCreatorStatus: Decodable, Sendable {
    public let creatorApproved: Bool
    public let application: Application?
    public struct Application: Decodable, Sendable { public let id: UUID; public let status: String }
}
