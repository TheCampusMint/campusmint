import Foundation
import CampusMintCore

private let accountID = UUID(uuidString: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")!
private let otherID = UUID(uuidString: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")!

private actor MemoryVault: SessionVault {
    var session: NativeSession?
    init(_ session: NativeSession? = nil) { self.session = session }
    func load() -> NativeSession? { session }
    func save(_ value: NativeSession) { session = value }
    func clear() { session = nil }
}

private actor MockTransport: HTTPTransport {
    struct Reply: Sendable { let status: Int; let json: String }
    var replies: [Reply]
    var requests: [URLRequest] = []
    init(_ replies: [Reply]) { self.replies = replies }
    func send(_ request: URLRequest) throws -> (Data, HTTPURLResponse) {
        requests.append(request)
        guard !replies.isEmpty else { throw CampusError.invalidResponse }
        let reply = replies.removeFirst()
        return (Data(reply.json.utf8), HTTPURLResponse(url: request.url!, statusCode: reply.status, httpVersion: nil, headerFields: nil)!)
    }
}

private func token(_ id: UUID = accountID, expired: Bool = false) -> NativeSession {
    NativeSession(accessToken: "test-access", refreshToken: "test-refresh", expiresAt: expired ? 1 : Date().timeIntervalSince1970 + 3600, userId: id)
}
private func accountJSON(_ id: UUID = accountID) -> String {
    """
    {"ok":true,"authenticated":true,"accountType":"student","onboardingComplete":true,"user":{"account":{"id":"\(id)","accountType":"student","universityId":"tamu","verifiedStudent":true,"verifiedAlumni":false},"profile":{"accountId":"\(id)","firstName":"A","lastName":"","displayName":"A","username":"student","bio":null,"major":null}}}
    """
}

func rejectsInsecureAndCredentialBearingServerURLs() throws {
    for value in ["http://example.com", "https://user:secret@example.com", "https://example.com/?key=value", "https://example.com/api"] {
        try expectThrows( CampusError.configuration) { try CampusAPI(baseURL: URL(string: value)!, vault: MemoryVault()) }
    }
}

func restoresCanonicalIdentityUsingBearerWithoutCookies() async throws {
    let network = MockTransport([.init(status: 200, json: accountJSON())])
    let api = try CampusAPI(baseURL: URL(string: "https://example.com")!, vault: MemoryVault(token()), transport: network)
    let result = try await api.restore()
    try expect(result?.user?.id == accountID)
    let requests = await network.requests
    try expect(requests[0].value(forHTTPHeaderField: "Authorization") == "Bearer test-access")
    try expect(requests[0].value(forHTTPHeaderField: "Cookie") == nil)
    try expect(requests[0].url?.path == "/api/account/me")
}

func rejectsProfileIdentitySwitch() async throws {
    let network = MockTransport([.init(status: 200, json: accountJSON(otherID))])
    let vault = MemoryVault(token())
    let api = try CampusAPI(baseURL: URL(string: "https://example.com")!, vault: vault, transport: network)
    try await expectThrows( CampusError.identityMismatch) { try await api.restore() }
    try expect(await vault.load() == nil)
    try await expectThrows(CampusError.signedOut) { try await api.feed() }
}

func refreshNeverChangesCanonicalAccount() async throws {
    let changed = String(data: try JSONEncoder().encode(token(otherID)), encoding: .utf8)!
    let vault = MemoryVault(token(expired: true))
    let network = MockTransport([.init(status: 200, json: "{\"ok\":true,\"session\":\(changed)}")])
    let api = try CampusAPI(baseURL: URL(string: "https://example.com")!, vault: vault, transport: network)
    try await expectThrows( CampusError.identityMismatch) { try await api.restore() }
    try expect(await vault.load() == nil)
    try await expectThrows(CampusError.signedOut) { try await api.feed() }
}

func revokedRefreshTokenErasesSession() async throws {
    let vault = MemoryVault(token(expired: true))
    let network = MockTransport([.init(status: 401, json: "{\"message\":\"Sign in again.\"}")])
    let api = try CampusAPI(baseURL: URL(string: "https://example.com")!, vault: vault, transport: network)
    try await expectThrows(CampusError.signedOut) { try await api.restore() }
    try expect(await vault.load() == nil)
}

func transientRefreshFailureRetainsSessionForRetry() async throws {
    let stored = token(expired: true)
    let vault = MemoryVault(stored)
    let network = MockTransport([.init(status: 503, json: "{\"message\":\"Try again.\"}")])
    let api = try CampusAPI(baseURL: URL(string: "https://example.com")!, vault: vault, transport: network)
    try await expectThrows(CampusError.server(503, "Try again.")) { try await api.restore() }
    try expect(await vault.load() == stored)
}

func unauthorizedFeedErasesSession() async throws {
    let vault = MemoryVault(token())
    let network = MockTransport([.init(status: 200, json: accountJSON()), .init(status: 401, json: "{}")])
    let api = try CampusAPI(baseURL: URL(string: "https://example.com")!, vault: vault, transport: network)
    _ = try await api.restore()
    try await expectThrows(CampusError.signedOut) { try await api.feed() }
    try expect(await vault.load() == nil)
}

func expiredSessionRefreshesAndPersistsRotatedTokens() async throws {
    let rotated = NativeSession(accessToken: "rotated", refreshToken: "new-refresh", expiresAt: Date().timeIntervalSince1970 + 3600, userId: accountID)
    let encoded = String(data: try JSONEncoder().encode(rotated), encoding: .utf8)!
    let vault = MemoryVault(token(expired: true))
    let network = MockTransport([.init(status: 200, json: "{\"ok\":true,\"session\":\(encoded)}"), .init(status: 200, json: accountJSON())])
    let api = try CampusAPI(baseURL: URL(string: "https://example.com")!, vault: vault, transport: network)
    _ = try await api.restore()
    try expect(await vault.load() == rotated)
    let requests = await network.requests
    try expect(requests[0].url?.path == "/api/native/session/refresh")
    try expect(requests[0].value(forHTTPHeaderField: "Authorization") == nil)
    try expect(requests[1].value(forHTTPHeaderField: "Authorization") == "Bearer rotated")
}

func signOutErasesKeychainEvenIfNetworkFails() async throws {
    let vault = MemoryVault(token())
    let network = MockTransport([.init(status: 200, json: accountJSON()), .init(status: 503, json: "{}")])
    let api = try CampusAPI(baseURL: URL(string: "https://example.com")!, vault: vault, transport: network)
    _ = try await api.restore()
    do { try await api.signOut() } catch { }
    try expect(await vault.load() == nil)
    try await expectThrows( CampusError.signedOut) { try await api.feed() }
}

func postIsPublicPermanentAndRetryIDIsStable() throws {
    let id = UUID()
    let post = try TextPostRequest(caption: "  Hi campus!\n", requestID: id)
    let data = try JSONEncoder().encode(post)
    let json = try require(JSONSerialization.jsonObject(with: data) as? [String: Any])
    let payload = try require(json["payload"] as? [String: Any])
    try expect(json["action"] as? String == "publish")
    try expect(payload["privacy"] as? String == "public")
    try expect(payload["caption"] as? String == "Hi campus!")
    try expect(payload["requestId"] as? String == id.uuidString.lowercased())
    try expect(payload["expiresAt"] == nil || payload["expiresAt"] is NSNull)
    try expectThrows( CampusError.emptyPost) { try TextPostRequest(caption: " \n\t") }
}

func noImplicitNativeSignupOrClientIdentityFields() async throws {
    let network = MockTransport([.init(status: 200, json: "{\"ok\":true}")])
    let api = try CampusAPI(baseURL: URL(string: "https://example.com")!, vault: MemoryVault(), transport: network)
    try await api.requestCode(email: "student@university.edu")
    let requests = await network.requests
    let payload = try require(JSONSerialization.jsonObject(with: requests[0].httpBody!) as? [String: String])
    try expect(payload["mode"] == "sign_in")
    try expect(payload["userId"] == nil)
}

func socialRequestsKeepIdentityServerOwnedAndQueryEncoded() async throws {
    let network = MockTransport([.init(status:200,json:accountJSON()), .init(status:200,json:"{\"ok\":true,\"items\":[],\"hasMore\":false}"), .init(status:200,json:"{\"ok\":true}")])
    let api = try CampusAPI(baseURL: URL(string:"https://example.com")!, vault:MemoryVault(token()), transport:network)
    _ = try await api.restore()
    let page: SocialPage<SocialMessage> = try await api.socialPage("messages", target: otherID)
    try expect(page.items.isEmpty)
    let mutation = SocialMutation(action:"message",target:otherID,body:"Hello",requestID:accountID)
    let encoded = try JSONEncoder().encode(mutation)
    try await api.mutateSocialEncoded(encoded)
    let requests = await network.requests
    let query = URLComponents(url: requests[1].url!, resolvingAgainstBaseURL:false)!.queryItems!
    try expect(query.first(where: {$0.name == "target"})?.value == otherID.uuidString)
    try expect(requests[1].url?.path == "/api/social")
    try expect(requests[2].httpBody == encoded)
    let object = try JSONSerialization.jsonObject(with:encoded) as! [String:Any]
    try expect(object["actor"] == nil && object["p_actor"] == nil)
    try expect(object["requestId"] as? String == accountID.uuidString)
}

func authenticatedPathsRejectEncodedTraversalBeforeSending() async throws {
    struct Body: Encodable, Sendable {}
    struct Result: Decodable, Sendable {let ok:Bool}
    let network = MockTransport([.init(status:200,json:accountJSON())])
    let api = try CampusAPI(baseURL:URL(string:"https://example.com")!,vault:MemoryVault(token()),transport:network)
    _ = try await api.restore()
    for path in ["/api/%2e%2e/admin", "/api/account/../admin", "/api/social?actor=other", "/api/social#fragment", "/api/\\evil"] {
        try await expectThrows(CampusError.configuration) { () async throws -> Result in
            try await api.authenticatedRequest(path,body:Body())
        }
    }
    try expect(await network.requests.count == 1)
}

func discoveryRequestsUseTheAuthenticatedOrigin() async throws {
    let network = MockTransport([.init(status: 200, json: accountJSON()), .init(status: 200, json: "{\"clubs\":[]}")])
    let api = try CampusAPI(baseURL: URL(string: "https://example.com")!, vault: MemoryVault(token()), transport: network)
    _ = try await api.restore()
    let _: ClubsResponse = try await api.campusResource(.clubs, query: [.init(name: "universityId", value: "x&target=other")])
    let request = try require(await network.requests.last)
    try expect(request.url?.host == "example.com")
    try expect(request.url?.path == "/api/clubs")
    let parts = try require(URLComponents(url: request.url!, resolvingAgainstBaseURL: false))
    try expect(parts.queryItems?.count == 1)
    try expect(parts.queryItems?.first?.value == "x&target=other")
    try expect(request.value(forHTTPHeaderField: "Authorization") != nil)
}

func uploadsUseScopedStorageCapabilitiesAndKeepExactPublishBytes() async throws {
    let requestID = UUID(), attempt = UUID()
    let path = "\(accountID.uuidString.lowercased())/\(requestID.uuidString.lowercased())/\(attempt)/0-\(UUID()).jpg"
    let prepared = "{\"ok\":true,\"upload\":{\"ticket\":\"ticket\",\"files\":[{\"storagePath\":\"\(path)\",\"sortOrder\":0,\"token\":\"capability\"}]}}"
    let network = MockTransport([.init(status: 200, json: accountJSON()), .init(status: 200, json: prepared), .init(status: 200, json: "{}"), .init(status: 200, json: "{\"ok\":true}")])
    let api = try CampusAPI(baseURL: URL(string: "https://example.com")!, vault: MemoryVault(token()), transport: network)
    _ = try await api.restore()
    let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: file) }
    let bytes = Data([0xff, 0xd8, 0xff]); try bytes.write(to: file)
    let media = UploadMedia(mimeType: "image/jpeg", byteSize: bytes.count, width: 10, height: 5)
    let post = try TextPostRequest(caption: "", requestID: requestID, media: [media])
    let prepareBytes = try JSONEncoder().encode(PrepareUploadRequest(post: post, files: [media]))
    let preparedResponse = try await api.prepareUploadEncoded(prepareBytes, additionalHeaders: ["X-App-Attest-Assertion": "prepare-proof"])
    let upload = try require(preparedResponse.upload)
    try await api.uploadMedia(origin: URL(string: "https://example.supabase.co")!, destination: upload.files[0], owner: accountID, requestID: requestID, index: 0, media: media, file: file)
    let publishBytes = try JSONEncoder().encode(CompleteUploadRequest(post: post, ticket: upload.ticket))
    try await api.publishEncoded(publishBytes, additionalHeaders: ["X-App-Attest-Assertion": "publish-proof"])
    let requests = await network.requests
    try expect(requests.count == 4)
    try expect(requests[1].httpBody == prepareBytes && requests[3].httpBody == publishBytes)
    try expect(requests[1].value(forHTTPHeaderField: "X-App-Attest-Assertion") == "prepare-proof")
    try expect(requests[3].value(forHTTPHeaderField: "X-App-Attest-Assertion") == "publish-proof")
    try expect(requests[2].httpBody == bytes && requests[2].url?.host == "example.supabase.co")
    try expect(requests[2].value(forHTTPHeaderField: "Authorization") == nil)
    try expect(requests[2].value(forHTTPHeaderField: "X-App-Attest-Assertion") == nil)
    try await expectThrows(CampusError.identityMismatch) { try await api.uploadMedia(origin: URL(string: "https://example.supabase.co")!, destination: upload.files[0], owner: otherID, requestID: requestID, index: 0, media: media, file: file) }
    try expect(await network.requests.count == 4)
}

func nativePollVotesUseCanonicalSessionAndServerResults() async throws {
    let network = MockTransport([.init(status: 200, json: accountJSON()), .init(status: 200, json: "{\"ok\":true,\"poll\":{\"question\":\"Lunch?\",\"options\":[{\"id\":\"1\",\"label\":\"A\",\"voteCount\":1},{\"id\":\"2\",\"label\":\"B\",\"voteCount\":0}],\"totalVotes\":1,\"selectedOptionId\":\"1\"}}")])
    let api = try CampusAPI(baseURL: URL(string: "https://example.com")!, vault: MemoryVault(token()), transport: network)
    _ = try await api.restore()
    let body = Data("{\"optionId\":\"1\"}".utf8)
    let result = try await api.votePollEncoded(id: otherID, body: body, additionalHeaders: ["X-App-Attest-Assertion": "vote-proof"])
    try expect(result.totalVotes == 1 && result.selectedOptionId == "1")
    let request = try require(await network.requests.last)
    try expect(request.url?.path == "/api/mintz/\(otherID.uuidString.lowercased())/poll")
    try expect(request.httpBody == body && request.value(forHTTPHeaderField: "Authorization") == "Bearer test-access")
    try expect(request.value(forHTTPHeaderField: "X-App-Attest-Assertion") == "vote-proof")
}
