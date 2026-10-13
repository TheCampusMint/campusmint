import Foundation

public enum CampusResource: String, Sendable {
    case sports = "/api/sports", clubs = "/api/clubs", nearby = "/api/discovery/nearby", marketplace = "/api/marketplace"
}
public struct ClubsResponse: Decodable, Sendable { public let clubs: [CampusClub] }
public struct CampusClub: Decodable, Sendable, Identifiable {
    public let id: String; public let name: String; public let handle: String; public let summary: String; public let visibility: String
    public let memberCount: Int; public let role: String?; public let invited: Bool
    public let description: String?; public let location: String?; public let schedule: String?; public let website: String?
}
public struct SportsResponse: Decodable, Sendable {
    public let profile: AthleticsProfile; public let sportsInterests: [String]?
}
public struct AthleticsProfile: Decodable, Sendable {
    public let universityName: String; public let nickname: String; public let divisionLabel: String; public let conferenceLabel: String
    public let featuredSports: [String]; public let supportedSports: [String]; public let programs: [String: SportProgram]
    public func recommendations(now: Date = Date(), favorites: [String]) -> [SportProgram] {
        var seen = Set<String>()
        let catalog = (featuredSports + supportedSports).filter { supportedSports.contains($0) && seen.insert($0).inserted }.compactMap { programs[$0] }
        return Array(catalog.enumerated().sorted { lhs, rhs in
            let a = lhs.element.inSeason(now), b = rhs.element.inSeason(now)
            if a != b { return a }
            let af = a && favorites.contains(lhs.element.sport), bf = b && favorites.contains(rhs.element.sport)
            return af != bf ? af : lhs.offset < rhs.offset
        }.prefix(3).map(\.element))
    }
}
public struct SportProgram: Decodable, Sendable, Identifiable {
    public var id: String { sport }
    public let sport: String; public let label: String; public let seasonLabel: String
    public let seasonStart: String; public let seasonEnd: String; public let schedulePublished: Bool
    public let games: [CampusGame]; public let record: String?; public let source: SportSource
    public func inSeason(_ now: Date) -> Bool {
        if schedulePublished && !games.isEmpty, let start = campusDate(seasonStart), let end = campusDate(String(seasonEnd.prefix(10)) + "T23:59:59Z") { return now >= start && now <= end }
        let months = ["football":[8,9,10,11,12,1], "basketball":[11,12,1,2,3,4], "baseball":[2,3,4,5,6], "soccer":[8,9,10,11,12], "volleyball":[8,9,10,11,12], "softball":[2,3,4,5,6], "gymnastics":[1,2,3,4], "track":[1,2,3,4,5,6], "hockey":[10,11,12,1,2,3,4], "rowing":[9,10,11,3,4,5,6], "golf":[9,10,11,2,3,4,5,6], "equestrian":[9,10,11,1,2,3,4], "lacrosse":[2,3,4,5], "tennis":[1,2,3,4,5]]
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return months[sport]?.contains(calendar.component(.month, from: now)) == true
    }
    public func seasonRecord(now: Date = Date()) -> String? {
        if games.contains(where: { $0.status != "final" && (campusDate($0.date).map { $0 <= now } ?? false) }) { return nil }
        if let record, record.range(of: #"^\d+\s*[-–]\s*\d+(?:\s*[-–]\s*\d+)?$"#, options: .regularExpression) != nil { return record }
        guard schedulePublished, !games.isEmpty, !games.contains(where: { $0.status == "verification_pending" }) else { return nil }
        let results = games.filter { $0.status == "final" && $0.result != nil && $0.opponentName.range(of: "exhibition|scrimmage", options: [.regularExpression, .caseInsensitive]) == nil }
        if results.isEmpty && ["golf", "track", "rowing"].contains(sport) { return nil }
        let wins = results.filter { $0.result == "W" }.count, losses = results.filter { $0.result == "L" }.count, ties = results.filter { $0.result == "T" }.count
        return "\(wins)–\(losses)" + (ties > 0 ? "–\(ties)" : "")
    }
}
public struct SportSource: Decodable, Sendable { public let sourceUrl: String }
public struct CampusGame: Decodable, Sendable, Identifiable {
    public let id: String; public let opponentName: String; public let date: String; public let dateLabel: String
    public let timeLabel: String?; public let homeAway: String; public let location: String?; public let network: String?
    public let status: String; public let campusScore: Int?; public let opponentScore: Int?; public let result: String?
    public let scheduleSourceUrl: String?; public let boxScoreSourceUrl: String?
    public func statusLabel(now: Date = Date()) -> String {
        if status == "final" { return "Final" }; if status == "live" { return "Live" }
        return campusDate(date).map { $0 > now ? "Upcoming" : "Awaiting result" } ?? "Scheduled"
    }
}
public func campusDate(_ value: String) -> Date? {
    let formatter = ISO8601DateFormatter()
    if value.count == 10 { return formatter.date(from: value + "T00:00:00Z") }
    if let date = formatter.date(from: value) { return date }
    formatter.formatOptions.insert(.withFractionalSeconds); return formatter.date(from: value)
}
public struct NearbyResponse: Decodable, Sendable { public let items: [NearbyPlace]; public let configured: Bool? }
public struct NearbyPlace: Decodable, Sendable, Identifiable {
    public let id: String; public let title: String; public let description: String; public let address: String
    public let website: String?; public let image: String?; public let source: String; public let sourceUrl: String
    public let startsAt: String?; public let rating: Double?; public let ratingCount: Int?
    public let imageCredit: String?; public let imageCreditUrl: String?
}
public struct MarketplaceResponse: Decodable, Sendable { public let listings: [CampusListing] }
public struct CampusListing: Decodable, Sendable, Identifiable {
    public let id: String; public let title: String; public let brand: String; public let condition: String
    public let askingPrice: Double; public let pickupArea: String; public let sellerId: String; public let status: String
}
