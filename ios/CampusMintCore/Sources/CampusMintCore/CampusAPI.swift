import Foundation

public protocol HTTPTransport: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse)
    func upload(_ request: URLRequest, from file: URL) async throws -> (Data, HTTPURLResponse)
}
public extension HTTPTransport {
    func upload(_ request: URLRequest, from file: URL) async throws -> (Data, HTTPURLResponse) {
        var copy = request; copy.httpBody = try Data(contentsOf: file)
        return try await send(copy)
    }
}

private final class NoRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
                    completionHandler: @escaping @Sendable (URLRequest?) -> Void) {
        // Never forward an authenticated request to a different URL or downgrade TLS.
        completionHandler(nil)
    }
}

public final class SecureHTTPTransport: HTTPTransport, Sendable {
    private let session: URLSession
    public init() {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = nil
        configuration.httpShouldSetCookies = false
        configuration.urlCache = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 600
        session = URLSession(configuration: configuration, delegate: NoRedirects(), delegateQueue: nil)
    }
    public func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw CampusError.invalidResponse }
        return (data, response)
    }
    public func upload(_ request: URLRequest, from file: URL) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await session.upload(for: request, fromFile: file)
        guard let response = response as? HTTPURLResponse else { throw CampusError.invalidResponse }
        return (data, response)
    }

}

public actor CampusAPI {
    private let baseURL: URL
    private let vault: any SessionVault
    private let transport: any HTTPTransport
    private var session: NativeSession?
    private var refreshTask: Task<NativeSession, Error>?
    private var sessionGeneration = UUID()

    public init(baseURL: URL, vault: any SessionVault, transport: any HTTPTransport = SecureHTTPTransport()) throws {
        guard baseURL.scheme == "https", baseURL.host != nil, baseURL.user == nil,
              baseURL.password == nil, baseURL.query == nil, baseURL.fragment == nil,
              baseURL.path.isEmpty || baseURL.path == "/" else { throw CampusError.configuration }
        self.baseURL = baseURL; self.vault = vault; self.transport = transport
    }

    public func restore() async throws -> AccountResponse? {
        guard let stored = try await vault.load() else { return nil }
        try stored.validate()
        session = stored
        return try await account()
    }

    public func requestCode(email: String) async throws {
        struct Body: Encodable { let email: String; let mode = "sign_in" }
        let result: OK = try await request("/api/student-verification/request", method: "POST", body: Body(email: email))
        guard result.ok else { throw CampusError.invalidResponse }
    }

    public func verifyCode(email: String, code: String) async throws -> AccountResponse {
        struct Body: Encodable { let email: String; let code: String; let mode = "sign_in"; let client = "ios" }
        struct Result: Decodable { let ok: Bool; let userId: UUID; let session: NativeSession }
        let result: Result = try await request("/api/student-verification/verify", method: "POST", body: Body(email: email, code: code))
        guard result.ok else { throw CampusError.invalidSession }
        try result.session.validate(expectedUserID: result.userId)
        sessionGeneration = UUID()
        try await vault.save(result.session)
        session = result.session
        return try await account()
    }

    /// Signup is an explicit flow; ordinary sign-in never creates an account.
    public func requestStudentSignupCode(email: String) async throws {
        struct Body: Encodable { let email: String; let mode = "sign_up"; let accountType = "student"; let client = "ios" }
        let result: OK = try await request("/api/student-verification/request", method: "POST", body: Body(email: email))
        guard result.ok else { throw CampusError.invalidResponse }
    }
    public func verifyStudentSignup(email: String, code: String) async throws -> AccountResponse {
        struct Body: Encodable { let email: String; let code: String; let mode = "sign_up"; let accountType = "student"; let client = "ios" }
        struct Result: Decodable { let ok: Bool; let userId: UUID; let session: NativeSession }
        let result: Result = try await request("/api/student-verification/verify", method: "POST", body: Body(email: email, code: code))
        guard result.ok else { throw CampusError.invalidSession }; try result.session.validate(expectedUserID: result.userId)
        sessionGeneration = UUID(); try await vault.save(result.session); session = result.session
        return try await account()
    }
    public func completeStudentSignupEncoded(_ data: Data, owner: UUID, additionalHeaders: [String: String] = [:]) async throws -> AccountResponse {
        let result: OK = try await authenticated("/api/account/complete", method: "POST", data: data, additionalHeaders: additionalHeaders, expectedOwner: owner)
        guard result.ok else { throw CampusError.invalidResponse }; return try await account()
    }

    public func account() async throws -> AccountResponse {
        let active = try await activeSession()
        let response: AccountResponse = try await authenticated("/api/account/me", method: "GET", data: nil)
        guard response.ok, response.authenticated == true else {
            try await invalidateSession()
            throw CampusError.signedOut
        }
        guard response.accountType == "student" else { throw CampusError.unsupportedAccount }
        if response.onboardingComplete == false && response.user == nil {
            guard response.authUserId == active.userId, session?.userId == active.userId, response.studentSetup != nil else { try await invalidateSession(); throw CampusError.identityMismatch }
            return response
        }
        guard let user = response.user else { throw CampusError.unsupportedAccount }
        guard user.id == active.userId, user.profile.accountId == active.userId,
              session?.userId == active.userId else {
            try await invalidateSession()
            throw CampusError.identityMismatch
        }
        return response
    }

    public func feed(ids: [UUID]? = nil) async throws -> MintFeedResponse {
        if let ids { guard !ids.isEmpty, ids.count <= 50 else { throw CampusError.configuration } }
        return try await authenticated("/api/mintz", method: "GET", data: nil, query: ids.map { [.init(name: "ids", value: $0.map { $0.uuidString }.joined(separator: ","))] } ?? [.init(name: "ranked", value: "1")])
    }

    /// Fixed API resources only; authorization and session generation checks stay centralized.
    public func campusResource<Response: Decodable & Sendable>(_ resource: CampusResource, query: [URLQueryItem] = []) async throws -> Response {
        try await authenticated(resource.rawValue, method: "GET", data: nil, query: query)
    }

    public func publish(_ post: TextPostRequest, additionalHeaders: [String: String] = [:]) async throws {
        try await publishEncoded(JSONEncoder().encode(post), additionalHeaders: additionalHeaders)
    }

    /// Send the exact bytes bound to an App Attest assertion, without re-encoding.
    public func publishEncoded(_ data: Data, additionalHeaders: [String: String] = [:], owner: UUID? = nil) async throws {
        let result: OK = try await authenticated("/api/mintz", method: "POST", data: data, additionalHeaders: additionalHeaders, expectedOwner: owner)
        guard result.ok else { throw CampusError.invalidResponse }
    }

    public func prepareUploadEncoded(_ data: Data, additionalHeaders: [String: String] = [:], owner: UUID? = nil) async throws -> PreparedUpload {
        let response: PreparedUpload = try await authenticated("/api/mintz", method: "POST", data: data, additionalHeaders: additionalHeaders, expectedOwner: owner)
        guard response.ok else { throw CampusError.invalidResponse }
        return response
    }

    public func uploadMedia(origin: URL, destination: PreparedUpload.Destination, owner: UUID, requestID: UUID, index: Int, media: UploadMedia, file: URL) async throws {
        let active = try await activeSession()
        let generation = sessionGeneration
        guard active.userId == owner else { throw CampusError.identityMismatch }
        try UploadMedia.validate([media])
        guard file.isFileURL, try file.resourceValues(forKeys: [.fileSizeKey]).fileSize == media.byteSize else { throw CampusError.invalidResponse }
        let request = try SignedMediaUpload.request(origin: origin, destination: destination, owner: owner, requestID: requestID, index: index, media: media)
        let (_, response) = try await transport.upload(request, from: file)
        guard generation == sessionGeneration, session?.userId == owner else { throw CampusError.signedOut }
        guard (200..<300).contains(response.statusCode) else { throw CampusError.invalidPost("Upload interrupted. Your draft is saved; try again.") }
    }

    public func votePollEncoded(id: UUID, body: Data, additionalHeaders: [String: String] = [:]) async throws -> MintPoll {
        struct Result: Decodable, Sendable { let ok: Bool; let poll: MintPoll }
        let result: Result = try await authenticated("/api/mintz/\(id.uuidString.lowercased())/poll", method: "POST", data: body, additionalHeaders: additionalHeaders)
        guard result.ok else { throw CampusError.invalidResponse }
        return result.poll
    }

    public func configuration() async throws -> NativeConfig {
        try await request("/api/native/config", method: "GET", body: Optional<Empty>.none)
    }

    public func authenticatedRequest<Response: Decodable & Sendable, Body: Encodable & Sendable>(
        _ path: String, body: Body, additionalHeaders: [String: String] = [:]
    ) async throws -> Response {
        try await authenticated(path, method: "POST", data: JSONEncoder().encode(body), additionalHeaders: additionalHeaders)
    }

    public func socialPage<Row: Decodable & Sendable>(_ resource: String, target: UUID? = nil, before: SocialCursor? = nil) async throws -> SocialPage<Row> {
        var query = [URLQueryItem(name: "resource", value: resource)]
        if let target { query.append(URLQueryItem(name: "target", value: target.uuidString)) }
        if let before {
            query.append(URLQueryItem(name: "before", value: before.date))
            query.append(URLQueryItem(name: "beforeId", value: before.id.uuidString))
        }
        return try await authenticated("/api/social", method: "GET", data: nil, query: query)
    }

    public func socialDetail<Response: Decodable & Sendable>(_ resource: SocialDetail, target: UUID? = nil, search: String = "", after: UUID? = nil) async throws -> Response {
        guard search.utf16.count <= 80, ![SocialDetail.post, .profile, .attendance].contains(resource) || target != nil else { throw CampusError.configuration }
        var query = [URLQueryItem(name: "resource", value: resource.rawValue)]
        if let target { query.append(.init(name: "target", value: target.uuidString)) }
        if !search.isEmpty { query.append(.init(name: "query", value: search)) }
        if let after { query.append(.init(name: "after", value: after.uuidString)) }
        return try await authenticated("/api/social", method: "GET", data: nil, query: query)
    }

    public func placeResource<Response: Decodable & Sendable>(id: String, view: PlaceResource) async throws -> Response {
        guard id.range(of: "^[A-Za-z0-9_-]{1,255}$", options: .regularExpression) != nil else { throw CampusError.configuration }
        let path = "/api/places/" + id
        switch view {
        case .details: return try await authenticated(path, method: "GET", data: nil)
        case .reviews: return try await authenticated(path, method: "GET", data: nil, query: [.init(name: "view", value: "reviews")])
        case .photo(let index):
            guard (0...4).contains(index) else { throw CampusError.configuration }
            return try await authenticated(path + "/photo", method: "GET", data: nil, query: [.init(name: "index", value: String(index))])
        }
    }

    public func mutateCampus(_ endpoint: CampusWrite, body: Data, owner: UUID, additionalHeaders: [String: String] = [:]) async throws -> CampusWriteResult {
        let result: CampusWriteResult = try await authenticated(endpoint.path, method: endpoint.method, data: body, additionalHeaders: additionalHeaders, expectedOwner: owner)
        guard result.ok else { throw CampusError.invalidResponse }
        return result
    }

    public func mutateSocialEncoded(_ data: Data, additionalHeaders: [String: String] = [:], owner: UUID? = nil) async throws {
        let result: OK = try await authenticated("/api/social", method: "POST", data: data, additionalHeaders: additionalHeaders, expectedOwner: owner)
        guard result.ok else { throw CampusError.invalidResponse }
    }

    /// The token never leaves the networking layer or enters observable UI state.
    public func observeSocialChanges(owner: UUID, configuration: SocialRealtimeConfiguration,
                                     changed: @escaping @Sendable () async -> Void) async throws {
        let generation = sessionGeneration
        let url = try configuration.socketURL()
        var delay: Double = 1
        while !Task.isCancelled {
            let started = Date()
            do {
                _ = try await realtimeToken(owner: owner, generation: generation)
                try Task.checkCancellation()
                try await SocialRealtimeConnection.run(socket: NativeSocialSocket(url: url), owner: owner,
                    token: { try await self.realtimeToken(owner: owner, generation: generation) }, changed: changed)
            } catch {
                try Task.checkCancellation()
                switch error {
                case CampusError.signedOut, CampusError.invalidSession, CampusError.identityMismatch: throw error
                default: break // Authorized HTTP fallback continues while the socket reconnects.
                }
            }
            if Date().timeIntervalSince(started) > 60 { delay = 1 }
            try await Task.sleep(for: .seconds(delay + Double.random(in: 0...0.5)))
            delay = min(delay * 2, 30)
        }
    }

    private func realtimeToken(owner: UUID, generation: UUID) async throws -> String {
        let active = try await activeSession()
        guard generation == sessionGeneration, active.userId == owner else { throw CampusError.signedOut }
        return active.accessToken
    }

    public func signOut() async throws {
        var failure: Error?
        do { let _: OK = try await authenticated("/api/account/logout", method: "POST", data: Data("{}".utf8)) }
        catch { failure = error }
        // Local removal always occurs, even while offline. Never leave another account’s feed visible.
        try await invalidateSession()
        if failure != nil { throw CampusError.server(503, "Signed out on this device. Server sign-out could not be confirmed.") }
    }

    private func invalidateSession() async throws {
        sessionGeneration = UUID()
        refreshTask?.cancel(); refreshTask = nil; session = nil
        try await vault.clear()
    }

    private func activeSession() async throws -> NativeSession {
        guard let existing = session else { throw CampusError.signedOut }
        if existing.expiresAt > Date().timeIntervalSince1970 + 60 { return existing }
        if let refreshTask {
            let generation = sessionGeneration
            let updated = try await refreshTask.value
            guard generation == sessionGeneration, session != nil else { throw CampusError.signedOut }
            return updated
        }
        let generation = sessionGeneration
        let task = Task { [self] () throws -> NativeSession in
            struct Body: Encodable { let refreshToken: String }
            struct Result: Decodable { let ok: Bool; let session: NativeSession }
            let response: Result = try await request("/api/native/session/refresh", method: "POST", body: Body(refreshToken: existing.refreshToken))
            guard response.ok else { throw CampusError.invalidSession }
            try response.session.validate(expectedUserID: existing.userId)
            return response.session
        }
        refreshTask = task
        defer { refreshTask = nil }
        let updated: NativeSession
        do {
            updated = try await task.value
        } catch {
            // A network outage may retry later. Revoked/invalid credentials must not survive restoration.
            if sessionGeneration == generation {
                switch error {
                case CampusError.server(401, _), CampusError.invalidSession, CampusError.identityMismatch:
                    try await invalidateSession()
                    if case CampusError.server(401, _) = error { throw CampusError.signedOut }
                default: break
                }
            }
            throw error
        }
        guard sessionGeneration == generation else { throw CampusError.signedOut }
        try await vault.save(updated)
        session = updated
        return updated
    }

    private func authenticated<Response: Decodable & Sendable>(_ path: String, method: String, data: Data?, additionalHeaders: [String: String] = [:], query: [URLQueryItem] = [], expectedOwner: UUID? = nil) async throws -> Response {
        let active = try await activeSession()
        if let expectedOwner, active.userId != expectedOwner { throw CampusError.signedOut }
        let generation = sessionGeneration
        do {
            let response: Response = try await perform(path, method: method, data: data, token: active.accessToken, additionalHeaders: additionalHeaders, query: query)
            guard sessionGeneration == generation else { throw CampusError.signedOut }
            return response
        } catch CampusError.server(401, _) {
            if sessionGeneration == generation {
                try await invalidateSession()
            }
            throw CampusError.signedOut
        }
    }

    private func request<Response: Decodable & Sendable, Body: Encodable>(_ path: String, method: String, body: Body?) async throws -> Response {
        try await perform(path, method: method, data: body.map { try JSONEncoder().encode($0) }, token: nil)
    }

    private func perform<Response: Decodable & Sendable>(_ path: String, method: String, data: Data?, token: String?, additionalHeaders: [String: String] = [:], query: [URLQueryItem] = []) async throws -> Response {
        guard path.range(of: #"^/api/[A-Za-z0-9/_-]+$"#, options: .regularExpression) != nil,
              let url = URL(string: path, relativeTo: baseURL)?.absoluteURL, url.host == baseURL.host,
              url.scheme == "https", url.port == baseURL.port else { throw CampusError.configuration }
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { throw CampusError.configuration }
        if !query.isEmpty { components.queryItems = query }
        guard let requestURL = components.url else { throw CampusError.configuration }
        var request = URLRequest(url: requestURL)
        request.httpMethod = method; request.httpBody = data
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("ios", forHTTPHeaderField: "X-CampusMint-Client")
        if data != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        for (key, value) in additionalHeaders where ["x-app-attest-key-id", "x-app-attest-challenge-id", "x-app-attest-assertion"].contains(key.lowercased()) {
            request.setValue(value, forHTTPHeaderField: key)
        }
        let (bytes, response) = try await transport.send(request)
        guard bytes.count <= 10_000_000 else { throw CampusError.invalidResponse }
        guard (200..<300).contains(response.statusCode) else {
            let message = (try? JSONDecoder().decode(Failure.self, from: bytes))?.message
            throw CampusError.server(response.statusCode, message ?? "Campus Mint is unavailable. Try again.")
        }
        do { return try JSONDecoder().decode(Response.self, from: bytes) }
        catch { throw CampusError.invalidResponse }
    }

    private struct Empty: Encodable {}
    private struct OK: Decodable { let ok: Bool }
    private struct Failure: Decodable { let message: String? }
}
