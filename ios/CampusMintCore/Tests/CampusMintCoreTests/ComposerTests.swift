import Foundation
import CampusMintCore

func pollAndMediaPostsValidateBeforePublishing() throws {
    let poll = PollInput(question: "  Lunch?  ", options: [" Tacos ", "Pizza"])
    let post = try TextPostRequest(caption: "\n", poll: poll)
    try expect(post.payload.poll?.question == "Lunch?")
    try expect(post.payload.poll?.options == ["Tacos", "Pizza"])
    for invalid in [PollInput(question: "", options: ["A", "B"]), PollInput(question: "?", options: ["A", " a "]), PollInput(question: "?", options: ["A"]), PollInput(question: "?", options: Array(repeating: "A", count: 7))] {
        do { _ = try TextPostRequest(caption: "Caption", poll: invalid); throw CheckFailure(description: "Invalid poll accepted") } catch is CampusError { }
    }
    let media = UploadMedia(mimeType: "image/jpeg", byteSize: 100, width: 100, height: 50)
    let mediaOnly = try TextPostRequest(caption: "", media: [media])
    try expect(mediaOnly.payload.caption.isEmpty && mediaOnly.payload.mediaMetadata.first?.width == 100)
    for files in [Array(repeating: media, count: 7), [UploadMedia(mimeType: "image/svg+xml", byteSize: 10, width: 1, height: 1)], [UploadMedia(mimeType: "video/mp4", byteSize: 101 * 1024 * 1024, width: 1, height: 1)], Array(repeating: UploadMedia(mimeType: "video/mp4", byteSize: 80 * 1024 * 1024, width: 1, height: 1), count: 2)] {
        do { try UploadMedia.validate(files); throw CheckFailure(description: "Invalid upload accepted") } catch is CampusError { }
    }
}

func signedUploadNeverCarriesAccountCredentialsAndRejectsForeignPaths() throws {
    let owner = UUID(), requestID = UUID(), attempt = UUID()
    let path = "\(owner.uuidString.lowercased())/\(requestID.uuidString.lowercased())/\(attempt)/0-\(UUID()).jpg"
    func destination(_ path: String, index: Int = 0) throws -> PreparedUpload.Destination {
        let json = try JSONSerialization.data(withJSONObject: ["storagePath": path, "sortOrder": index, "token": "signed+/=&token"])
        return try JSONDecoder().decode(PreparedUpload.Destination.self, from: json)
    }
    let media = UploadMedia(mimeType: "image/jpeg", byteSize: 12, width: 10, height: 5)
    let origin = URL(string: "https://example.supabase.co")!
    let request = try SignedMediaUpload.request(origin: origin, destination: destination(path), owner: owner, requestID: requestID, index: 0, media: media)
    try expect(request.httpMethod == "PUT")
    try expect(request.value(forHTTPHeaderField: "Authorization") == nil && request.value(forHTTPHeaderField: "Cookie") == nil)
    try expect(request.value(forHTTPHeaderField: "x-upsert") == "false")
    try expect(URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?.queryItems?.first?.value == "signed+/=&token")
    for bad in [path.replacingOccurrences(of: owner.uuidString.lowercased(), with: UUID().uuidString.lowercased()), path + "/../x", path.replacingOccurrences(of: "0-", with: "1-"), path.replacingOccurrences(of: ".jpg", with: ".mp4")] {
        try expectThrows(CampusError.invalidResponse) { try SignedMediaUpload.request(origin: origin, destination: destination(bad), owner: owner, requestID: requestID, index: 0, media: media) }
    }
    for bad in ["http://example.supabase.co", "https://evil.example", "https://example.supabase.co.evil.example", "https://user@example.supabase.co", "https://example.supabase.co/other"] {
        try expectThrows(CampusError.invalidResponse) { try SignedMediaUpload.request(origin: URL(string: bad)!, destination: destination(path), owner: owner, requestID: requestID, index: 0, media: media) }
    }
}

func draftsSurviveRestartWithoutCrossAccountAccess() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let owner = UUID(), other = UUID()
    let store = DraftStore(root: root)
    var draft = ComposerDraft(); draft.caption = "Saved locally"; draft.privacy = .private; draft.durationHours = 24
    draft.poll = PollInput(question: "Lunch?", options: ["A", "B"])
    draft.media = [UploadMedia(mimeType: "image/jpeg", byteSize: 3, width: 3, height: 1)]
    let mediaURL = try await store.mediaURL(owner: owner, draft: draft.id, media: draft.media[0])
    try Data([1,2,3]).write(to: mediaURL)
    try await store.save(draft, owner: owner)
    let restarted = DraftStore(root: root)
    try expect(try await restarted.list(owner: owner) == [draft])
    try expect(try await restarted.list(owner: other).isEmpty)
    try await restarted.delete(draft.id, owner: other)
    try expect(try await restarted.list(owner: owner).first?.requestID == draft.requestID)
    try await restarted.delete(draft.id, owner: owner)
    try expect(try await restarted.list(owner: owner).isEmpty)
    try expect(!FileManager.default.fileExists(atPath: mediaURL.path))
    let empty = ComposerDraft(); try await restarted.save(empty, owner: owner)
    try expect(try await restarted.list(owner: owner).isEmpty)
}

func prepareAndPublishUseTheSamePayloadAndRetryIdentity() throws {
    let post = try TextPostRequest(caption: "Photo", privacy: .connections, media: [UploadMedia(mimeType: "image/jpeg", byteSize: 300, width: 40, height: 20)])
    let files = [UploadMedia(mimeType: "image/jpeg", byteSize: 300, width: 40, height: 20)]
    let prepare = try require(JSONSerialization.jsonObject(with: JSONEncoder().encode(PrepareUploadRequest(post: post, files: files))) as? [String: Any])
    let publish = try require(JSONSerialization.jsonObject(with: JSONEncoder().encode(CompleteUploadRequest(post: post, ticket: "scoped-ticket"))) as? [String: Any])
    try expect((prepare["payload"] as? NSDictionary) == (publish["payload"] as? NSDictionary))
    try expect(publish["uploadTicket"] as? String == "scoped-ticket")
    try expect(prepare["action"] as? String == "prepare" && publish["action"] as? String == "publish")
}
