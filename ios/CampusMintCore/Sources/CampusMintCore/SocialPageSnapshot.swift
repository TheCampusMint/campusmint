import Foundation

/// Refresh all currently loaded pages so edits, deletes and permission changes reconcile history.
public struct SocialPageSnapshot<Row: SocialRow>: Sendable {
    public let rows: [Row]
    public let hasMore: Bool
    public let loadedPages: Int
    public static func load(previous: [Row], loadedPages: Int, older: Bool,
                            fetch: @Sendable (SocialCursor?) async throws -> SocialPage<Row>) async throws -> Self {
        var rows: [Row] = older ? previous : []
        var cursor = older ? previous.last.map { SocialCursor(date: $0.pageDate, id: $0.id) } : nil
        var hasMore = false, pages = older ? loadedPages : 0
        for _ in 0..<(older ? 1 : max(1, loadedPages)) {
            try Task.checkCancellation()
            let page = try await fetch(cursor)
            try Task.checkCancellation()
            guard page.ok else { throw CampusError.invalidResponse }
            let known = Set(rows.map(\.id))
            let fresh = page.items.filter { !known.contains($0.id) }
            rows += fresh; hasMore = page.hasMore; pages += 1
            guard hasMore, let last = page.items.last else { hasMore = false; break }
            if last.id == cursor?.id { throw CampusError.invalidResponse }
            cursor = SocialCursor(date: last.pageDate, id: last.id)
        }
        return Self(rows: rows, hasMore: hasMore, loadedPages: pages)
    }
}
