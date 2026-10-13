import Foundation
import CampusMintCore

private func fixtureProgram(_ sport: String, start: String = "", end: String = "", games: [[String: Any]] = [], record: String? = nil) -> [String: Any] {
    ["sport": sport, "label": sport.capitalized, "seasonLabel": "Current season", "seasonStart": start, "seasonEnd": end, "schedulePublished": !games.isEmpty, "games": games, "source": ["sourceUrl": "https://example.edu/athletics"], "record": record as Any? ?? NSNull()]
}
private func fixtureGame(_ id: String, date: String, status: String, result: String? = nil) -> [String: Any] {
    ["id": id, "opponentName": "Opponent", "date": date, "dateLabel": date, "homeAway": "home", "status": status, "result": result as Any? ?? NSNull()]
}
private func decodeFixture<T: Decodable>(_ value: Any, as type: T.Type) throws -> T { try JSONDecoder().decode(type, from: JSONSerialization.data(withJSONObject: value)) }

func sportsFavoritesRespectSeasonAndCampusOrder() throws {
    let profile = try decodeFixture(["universityName": "Test", "nickname": "Test", "divisionLabel": "NCAA", "conferenceLabel": "Test", "featuredSports": ["football", "basketball", "rowing"], "supportedSports": ["football", "basketball", "rowing", "golf"], "programs": ["football": fixtureProgram("football"), "basketball": fixtureProgram("basketball"), "rowing": fixtureProgram("rowing"), "golf": fixtureProgram("golf")]], as: AthleticsProfile.self)
    let october = try require(campusDate("2026-10-12"))
    try expect(profile.recommendations(now: october, favorites: []).map(\.id) == ["football", "rowing", "golf"])
    try expect(profile.recommendations(now: october, favorites: ["golf"]).map(\.id) == ["golf", "football", "rowing"])
    let january = try require(campusDate("2027-01-15"))
    try expect(profile.recommendations(now: january, favorites: ["golf"]).first?.id == "football")
}
func sportsFutureYearsAndIncompleteRecordsStayHonest() throws {
    let now = try require(campusDate("2026-10-12"))
    let future = fixtureGame("future", date: "2027-01-10", status: "verification_pending")
    let game = try decodeFixture(future, as: CampusGame.self)
    try expect(game.statusLabel(now: now) == "Upcoming")
    let pending = fixtureGame("past", date: "2026-10-03", status: "verification_pending")
    let program = try decodeFixture(fixtureProgram("football", start: "2026-09-01", end: "2027-01-10", games: [pending, future], record: "3–2"), as: SportProgram.self)
    try expect(program.inSeason(now))
    try expect(program.seasonRecord(now: now) == nil)
    try expect(!program.inSeason(try require(campusDate("2027-02-01"))))
}
func composerPrivacyAndExpirySurviveEncodingAndRetry() throws {
    let id = UUID(), expiry = "2026-10-13T12:00:00Z"
    let request = try TextPostRequest(caption: "Private note", requestID: id, privacy: .private, expiresAt: expiry)
    let encoded = try JSONEncoder().encode(request)
    let root = try require(JSONSerialization.jsonObject(with: encoded) as? [String: Any])
    let payload = try require(root["payload"] as? [String: Any])
    try expect(payload["privacy"] as? String == "private")
    try expect(payload["expiresAt"] as? String == expiry)
    try expect(payload["requestId"] as? String == id.uuidString.lowercased())
    let retry = try require(JSONSerialization.jsonObject(with: JSONEncoder().encode(request)) as? NSDictionary)
    try expect(retry.isEqual(to: root))
}
