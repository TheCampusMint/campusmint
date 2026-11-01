import Foundation
import CampusMintCore

private func object<T: Encodable>(_ value: T) throws -> [String: Any] { try require(try JSONSerialization.jsonObject(with: JSONEncoder().encode(value)) as? [String: Any]) }

func clubActionsKeepIdentityAndRolesServerOwned() throws {
    let id = UUID(), person = UUID()
    let request = try object(ClubChange(.approve, club: id, target: person))
    try expect(request["action"] as? String == "approve" && request["targetId"] as? String == person.uuidString)
    try expect(request["actor"] == nil && request["role"] == nil)
    try expectThrows(CampusError.invalidPost("Choose a person.")) { try ClubChange(.invite, club: id) }
    var draft = ClubDraft(); draft.name = "Weekend hiking"; draft.handle = "weekend-hiking"; draft.description = "Student hikes"
    try expect(try object(draft.validated())["visibility"] as? String == "private")
    draft.website = "https://user:secret@example.com"
    try expectThrows(CampusError.invalidPost("Use an HTTPS link.")) { try draft.validated() }
    let club = try JSONDecoder().decode(CampusClub.self, from: Data(#"{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","name":"Club","handle":"club","summary":"Private","visibility":"private","memberCount":2,"role":"officer","invited":false,"editable":true}"#.utf8))
    let officer = try JSONDecoder().decode(ClubPerson.self, from: Data(#"{"id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","name":"B","username":"b","role":"officer"}"#.utf8))
    try expect(club.canManage && !club.canRemove(officer, actor: id))
}

func marketplaceValidationKeepsRetryIdentityAndLocationConsent() throws {
    var draft = ListingDraft(); draft.title = "Desk"; draft.pickupArea = "Library entrance"; draft.askingPrice = 12.50
    draft.nearbyLocation = CampusCoordinate(latitude: 30.6, longitude: -96.3)
    let first = try object(draft.validated()), retry = try object(draft.validated())
    try expect(first["requestId"] as? String == retry["requestId"] as? String)
    try expect(first["nearbyLocation"] == nil && first["sellerId"] == nil)
    draft.shareNearbyArea = true
    try expect(try object(draft.validated())["nearbyLocation"] != nil)
    draft.askingPrice = 1.001
    try expectThrows(CampusError.invalidPost("Enter a price with up to two decimal places.")) { try draft.validated() }
    draft.askingPrice = .infinity
    try expectThrows(CampusError.invalidPost("Enter a price with up to two decimal places.")) { try draft.validated() }
    draft.askingPrice = 0; draft.nearbyLocation = CampusCoordinate(latitude: 91, longitude: 0)
    try expectThrows(CampusError.invalidPost("Choose a listing area.")) { try draft.validated() }
    let message = try object(MarketplaceSend(listing: UUID(), buyer: nil, body: " Hello ", request: UUID()))
    try expect(message["body"] as? String == "Hello" && message["senderId"] == nil && message["buyerId"] == nil)
    try expectThrows(CampusError.invalidPost("Write a message up to 2,000 characters.")) { try MarketplaceSend(listing: UUID(), buyer: nil, body: " \n ", request: UUID()) }
}

func nativeProfileEditsPreserveIdentityAndEmptyLastName() throws {
    let profile = try JSONDecoder().decode(CampusProfile.self, from: Data(#"{"accountId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","firstName":"A","lastName":"","displayName":"A","username":"student","sportsInterests":["rowing"],"interests":["Books"],"graduationYear":2027}"#.utf8))
    var draft = ProfileDraft(profile); draft.graduationYear = nil; draft.bio = "Updated"
    let value = try require(try JSONSerialization.jsonObject(with: draft.encoded()) as? [String: Any])
    try expect(value["accountId"] == nil && value["capabilities"] == nil && value["verifiedStudent"] == nil)
    try expect(value["lastName"] as? String == "" && value["graduationYear"] is NSNull)
    try expect(value["sportsInterests"] as? [String] == ["rowing"])
}

func composerContextPreservesDraftsAndServerAuthority() throws {
    let club = UUID(), event = UUID(), person = UUID()
    let mention = PostMention(userId: person, username: "ada.student")
    let post = try TextPostRequest(caption: "Hi @ada.student #Campus #CAMPUS #Food", context: .init(kind: .club, clubID: club), mentions: [mention])
    let payload = try require((JSONSerialization.jsonObject(with: JSONEncoder().encode(post)) as? [String: Any])?["payload"] as? [String: Any])
    try expect(payload["postType"] as? String == "personal", file: #filePath, line: #line)
    try expect(payload["organizationId"] == nil)
    try expect(payload["taggedOrganizationIds"] as? [String] == [club.uuidString.lowercased()])
    try expect(payload["hashtags"] as? [String] == ["campus", "food"])
    try expect((payload["mentions"] as? [[String: String]])?.first?["userId"] == person.uuidString)
    try expect(PostMention.resolve([mention], caption: "@ada.student2 @adaXstudent").isEmpty)
    try expect(PostMention.resolve([mention], caption: "(@ADA.STUDENT)").count == 1)
    try expectThrows(.invalidPost("Choose a joined club.")) { try TextPostRequest(caption: "Hi", context: .init(kind: .club)) }
    try expectThrows(.invalidPost("Choose an event or add its location.")) { try TextPostRequest(caption: "Hi", context: .init(kind: .event, location: "  ")) }
    try expectThrows(.invalidPost("Event posts last 24 hours.")) { try TextPostRequest(caption: "Hi", context: .init(kind: .event, eventID: event)) }
    let eventPost = try TextPostRequest(caption: "Going?", expiresAt: "2027-01-01T01:00:00Z", context: .init(kind: .event, eventID: event, location: "ignored"))
    try expect(eventPost.payload.eventData?.eventId == event && eventPost.payload.location == nil)
    var draft = ComposerDraft(); draft.caption = "Old draft"
    let data = try JSONEncoder().encode(draft)
    var legacy = try require(JSONSerialization.jsonObject(with: data) as? [String: Any]); legacy.removeValue(forKey: "context"); legacy.removeValue(forKey: "mentions")
    let restored = try JSONDecoder().decode(ComposerDraft.self, from: JSONSerialization.data(withJSONObject: legacy))
    try expect(restored.id == draft.id && restored.context == nil && restored.mentions == nil)
    draft.context = .init(kind: .club, clubID: club); draft.mentions = [mention]
    try expect(try JSONDecoder().decode(ComposerDraft.self, from: JSONEncoder().encode(draft)) == draft)
}

func notificationDestinationsOnlyUseKnownTypedTargets() throws {
    let id = UUID(), actor = UUID(), target = UUID()
    func decode(_ kind: String, _ payload: [String: String] = [:]) throws -> SocialNotification {
        let data = try JSONSerialization.data(withJSONObject: ["id": id.uuidString, "actor_id": actor.uuidString, "kind": kind, "created_at": "2026-11-01T00:00:00Z", "payload": payload])
        return try JSONDecoder().decode(SocialNotification.self, from: data)
    }
    try expect(decode("private_message").destination == .message(actor))
    try expect(decode("person_follow").destination == .profile(actor))
    try expect(decode("club_invite", ["organizationId": target.uuidString]).destination == .club(target))
    try expect(decode("event_update", ["eventId": target.uuidString]).destination == .event(target))
    try expect(decode("club_invite", ["organizationId": "https://evil.example"]).destination == nil)
    try expect(decode("unknown", ["eventId": target.uuidString]).destination == nil)
    try expect(decode("event_invite").destination == nil)
}


func draftCommentPreferenceSurvivesRetryAndLegacyDrafts() throws {
    var draft = ComposerDraft(); draft.caption = "Hello"; draft.commentsEnabled = false
    let restored = try JSONDecoder().decode(ComposerDraft.self, from: JSONEncoder().encode(draft))
    let post = try TextPostRequest(caption: restored.caption, requestID: restored.requestID, commentsEnabled: restored.commentsEnabled ?? true)
    try expect(post.payload.commentsEnabled == false && post.payload.requestId == draft.requestID.uuidString.lowercased())
    let body = try require(JSONSerialization.jsonObject(with: JSONEncoder().encode(PrepareUploadRequest(post: post, files: []))) as? [String: Any])
    try expect((body["payload"] as? [String: Any])?["commentsEnabled"] as? Bool == false)
    var legacy = try require(JSONSerialization.jsonObject(with: JSONEncoder().encode(draft)) as? [String: Any]); legacy.removeValue(forKey: "commentsEnabled")
    let old = try JSONDecoder().decode(ComposerDraft.self, from: JSONSerialization.data(withJSONObject: legacy))
    try expect(old.commentsEnabled == nil)
    try expect(TextPostRequest(caption: old.caption).payload.commentsEnabled)
}
func creatorApplicationCannotClaimIdentityOrApproval() throws {
    var draft = CreatorApplicationDraft(); draft.externalHandle = " student "; draft.externalProfileUrl = "https://youtube.com/@student"; draft.claimedFollowerCount = 12
    let value = try draft.validated(); try expect(value.externalHandle == "student")
    let body = try require(JSONSerialization.jsonObject(with: JSONEncoder().encode(value)) as? [String: Any])
    try expect(body["userId"] == nil && body["accountType"] == nil && body["status"] == nil && body["creatorApproved"] == nil)
    try expect(CampusWrite.creatorApplication.path == "/api/creator/apply" && CampusWrite.creatorApplication.method == "POST")
    for link in ["http://youtube.com/@student", "https://token:secret@example.com/profile", "javascript:alert(1)"] {
        draft.externalProfileUrl = link
        try expectThrows(.invalidPost("Add a valid platform, handle, HTTPS profile link and follower count.")) { try draft.validated() }
    }
}
