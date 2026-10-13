import Foundation

/// Local drafts are separated by canonical auth UUID, protected on disk, and excluded from backup.
/// No session, upload capability or access token is ever serialized here.
public actor DraftStore {
    private let root: URL
    public init(root: URL) { self.root = root }
    public func directory(owner: UUID, draft: UUID) throws -> URL {
        let url = root.appendingPathComponent(owner.uuidString).appendingPathComponent(draft.uuidString)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        try protect(url)
        return url
    }
    public func mediaURL(owner: UUID, draft: UUID, media: UploadMedia) throws -> URL {
        try directory(owner: owner, draft: draft).appendingPathComponent(media.filename)
    }
    public func save(_ draft: ComposerDraft, owner: UUID) throws {
        guard draft.hasContent else { try delete(draft.id, owner: owner); return }
        let dir = try directory(owner: owner, draft: draft.id)
        let data = try JSONEncoder().encode(draft)
        let url = dir.appendingPathComponent("draft.json")
        #if os(iOS)
        try data.write(to: url, options: [.atomic, .completeFileProtection])
        #else
        try data.write(to: url, options: .atomic)
        #endif
        try protect(url)
        // Save metadata first. Removed attachments can then be reclaimed without losing a draft.
        let retained = Set(draft.media.map(\.filename))
        for file in try FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil) {
            if ["jpg", "mp4"].contains(file.pathExtension), UUID(uuidString: file.deletingPathExtension().lastPathComponent) != nil, !retained.contains(file.lastPathComponent) {
                try? FileManager.default.removeItem(at: file)
            }
        }
    }
    public func list(owner: UUID) throws -> [ComposerDraft] {
        let dir = root.appendingPathComponent(owner.uuidString)
        guard FileManager.default.fileExists(atPath: dir.path) else { return [] }
        return try FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil).compactMap { entry in
            guard UUID(uuidString: entry.lastPathComponent) != nil else { return nil }
            let metadata = entry.appendingPathComponent("draft.json")
            guard FileManager.default.fileExists(atPath: metadata.path) else { return nil }
            let draft = try JSONDecoder().decode(ComposerDraft.self, from: Data(contentsOf: metadata))
            guard draft.id.uuidString == entry.lastPathComponent else { throw CampusError.invalidResponse }
            return draft
        }.sorted { $0.updatedAt > $1.updatedAt }
    }
    public func delete(_ id: UUID, owner: UUID) throws {
        let dir = root.appendingPathComponent(owner.uuidString).appendingPathComponent(id.uuidString)
        if FileManager.default.fileExists(atPath: dir.path) { try FileManager.default.removeItem(at: dir) }
    }
    public func protect(_ url: URL) throws {
        var mutable = url
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        try mutable.setResourceValues(values)
        #if os(iOS)
        try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: url.path)
        #endif
    }
}
