import Foundation

public struct PollInput: Codable, Sendable, Equatable {
    public var question: String
    public var options: [String]
    public init(question: String = "", options: [String] = ["", ""]) { self.question = question; self.options = options }
    public func validated() throws -> Self {
        let q = question.trimmingCharacters(in: .whitespacesAndNewlines)
        let answers = options.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        guard !q.isEmpty, q.utf16.count <= 280 else { throw CampusError.invalidPost("Add a poll question, up to 280 characters.") }
        guard (2...6).contains(answers.count), answers.allSatisfy({ !$0.isEmpty && $0.utf16.count <= 100 }), Set(answers.map { $0.lowercased() }).count == answers.count else {
            throw CampusError.invalidPost("Add two to six different answers, up to 100 characters each.")
        }
        return Self(question: q, options: answers)
    }
}

public struct UploadMedia: Codable, Sendable, Equatable, Identifiable {
    public let id: UUID
    public let mimeType: String
    public let byteSize: Int
    public let width: Int
    public let height: Int
    public let durationSeconds: Double?
    public var isVideo: Bool { mimeType == "video/mp4" }
    public var filename: String { id.uuidString.lowercased() + (isVideo ? ".mp4" : ".jpg") }
    public init(id: UUID = UUID(), mimeType: String, byteSize: Int, width: Int, height: Int, durationSeconds: Double? = nil) {
        self.id = id; self.mimeType = mimeType; self.byteSize = byteSize; self.width = width; self.height = height; self.durationSeconds = durationSeconds
    }
    public static func validate(_ files: [Self]) throws {
        guard files.count <= 6 else { throw CampusError.invalidPost("Choose up to six photos or videos.") }
        var total = 0
        for file in files {
            guard ["image/jpeg", "video/mp4"].contains(file.mimeType), file.byteSize > 0,
                  file.byteSize <= (file.isVideo ? 100 : 12) * 1024 * 1024,
                  file.width > 0, file.height > 0,
                  file.durationSeconds.map({ $0.isFinite && $0 >= 0 }) ?? true else {
                throw CampusError.invalidPost("Choose a photo under 12 MB or a video under 100 MB.")
            }
            total += file.byteSize
        }
        guard total <= 150 * 1024 * 1024 else { throw CampusError.invalidPost("Keep attachments under 150 MB total.") }
    }
}

public struct ComposerDraft: Codable, Sendable, Equatable, Identifiable {
    public var id = UUID()
    public var requestID = UUID()
    public var caption = ""
    public var privacy = PostPrivacy.public
    public var durationHours = 0
    public var expiresAt: String?
    public var poll: PollInput?
    public var media: [UploadMedia] = []
    public var updatedAt = Date()
    public init() {}
    public var hasContent: Bool { !caption.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || poll != nil || !media.isEmpty }
    public var label: String { caption.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? (poll?.question.isEmpty == false ? poll!.question : media.isEmpty ? "Poll" : "Media") : caption }
}

public struct PrepareUploadRequest: Encodable, Sendable {
    public let action = "prepare"
    public let payload: TextPostRequest.Payload
    public let files: [UploadMedia]
    public init(post: TextPostRequest, files: [UploadMedia]) { payload = post.payload; self.files = files }
}
public struct CompleteUploadRequest: Encodable, Sendable {
    public let action = "publish"
    public let payload: TextPostRequest.Payload
    public let uploadTicket: String
    public init(post: TextPostRequest, ticket: String) { payload = post.payload; uploadTicket = ticket }
}
public struct PreparedUpload: Decodable, Sendable {
    public let ok: Bool
    public let upload: Upload?
    public let mint: PublishedMint?
    public struct PublishedMint: Decodable, Sendable { public let id: String }
    public struct Upload: Decodable, Sendable {
        public let ticket: String
        public let files: [Destination]
    }
    public struct Destination: Decodable, Sendable {
        public let storagePath: String
        public let sortOrder: Int
        public let token: String
    }
}

/// Only a scoped upload capability is sent to Storage. Never the Campus Mint session token.
public enum SignedMediaUpload {
    public static func request(origin: URL, destination: PreparedUpload.Destination, owner: UUID, requestID: UUID, index: Int, media: UploadMedia) throws -> URLRequest {
        guard origin.scheme == "https", let host = origin.host, host.hasSuffix(".supabase.co"),
              origin.user == nil, origin.password == nil, origin.port == nil,
              origin.query == nil, origin.fragment == nil, ["", "/"].contains(origin.path),
              !destination.token.isEmpty, destination.sortOrder == index else { throw CampusError.invalidResponse }
        let pieces = destination.storagePath.split(separator: "/", omittingEmptySubsequences: false).map(String.init)
        guard pieces.count == 4, pieces[0] == owner.uuidString.lowercased(), pieces[1] == requestID.uuidString.lowercased(), UUID(uuidString: pieces[2]) != nil,
              pieces[3].range(of: "^\(index)-[A-Fa-f0-9-]{36}\\.(jpg|mp4)$", options: .regularExpression) != nil,
              pieces[3].hasSuffix(media.isVideo ? ".mp4" : ".jpg") else { throw CampusError.invalidResponse }
        var url = URLComponents(url: origin, resolvingAgainstBaseURL: false)!
        url.path = "/storage/v1/object/upload/sign/mint-media/" + destination.storagePath
        url.queryItems = [.init(name: "token", value: destination.token)]
        guard let target = url.url else { throw CampusError.invalidResponse }
        var request = URLRequest(url: target)
        request.httpMethod = "PUT"
        request.timeoutInterval = 120
        request.setValue(media.mimeType, forHTTPHeaderField: "Content-Type")
        request.setValue("false", forHTTPHeaderField: "x-upsert")
        request.setValue("max-age=3600", forHTTPHeaderField: "Cache-Control")
        return request
    }
}
