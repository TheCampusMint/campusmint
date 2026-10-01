import Foundation

public protocol HTTPTransport: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse)
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
        configuration.timeoutIntervalForResource = 60
        session = URLSession(configuration: configuration, delegate: NoRedirects(), delegateQueue: nil)
    }
    public func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await session.data(for: request)
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

    public func account() async throws -> AccountResponse {
        let active = try await activeSession()
        let response: AccountResponse = try await authenticated("/api/account/me", method: "GET", data: nil)
        guard response.ok, response.authenticated == true else {
            try await invalidateSession()
            throw CampusError.signedOut
        }
        guard response.accountType == "student", let user = response.user else { throw CampusError.unsupportedAccount }
        guard user.id == active.userId, user.profile.accountId == active.userId,
              session?.userId == active.userId else {
            try await invalidateSession()
            throw CampusError.identityMismatch
        }
        return response
    }

    public func feed() async throws -> MintFeedResponse {
        try await authenticated("/api/mintz", method: "GET", data: nil)
    }

    public func publish(_ post: TextPostRequest, additionalHeaders: [String: String] = [:]) async throws {
        try await publishEncoded(JSONEncoder().encode(post), additionalHeaders: additionalHeaders)
    }

    /// Send the exact bytes bound to an App Attest assertion, without re-encoding.
    public func publishEncoded(_ data: Data, additionalHeaders: [String: String] = [:]) async throws {
        let result: OK = try await authenticated("/api/mintz", method: "POST", data: data, additionalHeaders: additionalHeaders)
        guard result.ok else { throw CampusError.invalidResponse }
    }

    public func configuration() async throws -> NativeConfig {
        try await request("/api/native/config", method: "GET", body: Optional<Empty>.none)
    }

    public func authenticatedRequest<Response: Decodable & Sendable, Body: Encodable & Sendable>(
        _ path: String, body: Body, additionalHeaders: [String: String] = [:]
    ) async throws -> Response {
        try await authenticated(path, method: "POST", data: JSONEncoder().encode(body), additionalHeaders: additionalHeaders)
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

    private func authenticated<Response: Decodable & Sendable>(_ path: String, method: String, data: Data?, additionalHeaders: [String: String] = [:]) async throws -> Response {
        let active = try await activeSession()
        let generation = sessionGeneration
        do {
            let response: Response = try await perform(path, method: method, data: data, token: active.accessToken, additionalHeaders: additionalHeaders)
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

    private func perform<Response: Decodable & Sendable>(_ path: String, method: String, data: Data?, token: String?, additionalHeaders: [String: String] = [:]) async throws -> Response {
        guard path.hasPrefix("/api/"), !path.contains(".."), !path.contains("?"), !path.contains("#"),
              let url = URL(string: path, relativeTo: baseURL)?.absoluteURL, url.host == baseURL.host,
              url.scheme == "https", url.port == baseURL.port else { throw CampusError.configuration }
        var request = URLRequest(url: url)
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
