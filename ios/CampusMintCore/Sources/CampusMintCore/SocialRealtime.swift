import Foundation

public struct SocialRealtimeConfiguration: Decodable, Sendable {
    public let url: String
    public let publishableKey: String

    public func socketURL() throws -> URL {
        guard var parts = URLComponents(string: url), parts.scheme == "https",
              let host = parts.host, host.range(of: "^[a-z0-9]+\\.supabase\\.co$", options: .regularExpression) != nil,
              parts.user == nil, parts.password == nil, parts.port == nil,
              parts.query == nil, parts.fragment == nil, ["", "/"].contains(parts.path),
              !publishableKey.isEmpty, !publishableKey.hasPrefix("sb_secret_") else { throw CampusError.configuration }
        parts.scheme = "wss"; parts.path = "/realtime/v1/websocket"
        parts.queryItems = [.init(name: "apikey", value: publishableKey), .init(name: "vsn", value: "1.0.0")]
        guard let result = parts.url else { throw CampusError.configuration }
        return result
    }
}

/// One narrow Phoenix subscription: own-account revision hints only, never private row bodies.
/// https://supabase.com/docs/guides/realtime/protocol (v1 JSON frames).
public struct SocialRealtimeProtocol: Sendable {
    public enum Event: Equatable, Sendable { case joined, changed, heartbeat(String), ignored }
    public let owner: UUID
    public var topic: String { "realtime:social:\(owner.uuidString.lowercased())" }
    public init(owner: UUID) { self.owner = owner }
    private func message(_ event: String, ref: String, payload: [String: Any], topic: String? = nil) throws -> String {
        var value: [String: Any] = ["topic": topic ?? self.topic, "event": event, "ref": ref, "payload": payload]
        if topic == nil { value["join_ref"] = "join" }
        return String(decoding: try JSONSerialization.data(withJSONObject: value), as: UTF8.self)
    }
    public func join(token: String) throws -> String {
        try message("phx_join", ref: "join", payload: ["access_token": token, "config": [
            "broadcast": ["ack": false, "self": false], "presence": ["enabled": false], "private": false,
            "postgres_changes": [["event": "*", "schema": "public", "table": "social_sync_revisions", "filter": "user_id=eq.\(owner.uuidString.lowercased())"]]
        ]])
    }
    public func heartbeat(ref: String) throws -> String { try message("heartbeat", ref: ref, payload: [:], topic: "phoenix") }
    public func updateToken(_ token: String) throws -> String { try message("access_token", ref: UUID().uuidString, payload: ["access_token": token]) }
    public func receive(_ text: String) throws -> Event {
        guard text.utf8.count <= 65_536,
              let frame = try JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any],
              let event = frame["event"] as? String, let incomingTopic = frame["topic"] as? String,
              let payload = frame["payload"] as? [String: Any] else { throw CampusError.invalidResponse }
        if incomingTopic == "phoenix", event == "phx_reply", payload["status"] as? String == "ok", let ref = frame["ref"] as? String { return .heartbeat(ref) }
        guard incomingTopic == topic else { return .ignored }
        if event == "phx_close" || event == "phx_error" || (event == "system" && payload["status"] as? String == "error") { throw CampusError.invalidResponse }
        if event == "phx_reply" {
            guard payload["status"] as? String == "ok" else { throw CampusError.invalidResponse }
            if frame["ref"] as? String == "join" { return .joined }
        }
        if event == "postgres_changes", let data = payload["data"] as? [String: Any],
           data["schema"] as? String == "public", data["table"] as? String == "social_sync_revisions",
           let record = data["record"] as? [String: Any], let id = record["user_id"] as? String, UUID(uuidString: id) == owner { return .changed }
        return .ignored
    }
}

public protocol SocialSocket: Sendable {
    func send(_ text: String) async throws
    func receive() async throws -> String
    func close()
}

private final class RealtimeRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping @Sendable (URLRequest?) -> Void) { completionHandler(nil) }
}

final class NativeSocialSocket: SocialSocket, Sendable {
    private let session: URLSession
    private let socket: URLSessionWebSocketTask
    init(url: URL) {
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieStorage = nil; config.httpShouldSetCookies = false; config.urlCache = nil
        config.timeoutIntervalForRequest = 20
        session = URLSession(configuration: config, delegate: RealtimeRedirects(), delegateQueue: nil)
        socket = session.webSocketTask(with: url); socket.maximumMessageSize = 65_536; socket.resume()
    }
    func send(_ text: String) async throws { try await socket.send(.string(text)) }
    func receive() async throws -> String {
        switch try await socket.receive() {
        case .string(let text): return text
        default: throw CampusError.invalidResponse
        }
    }
    func close() { socket.cancel(with: .goingAway, reason: nil); session.invalidateAndCancel() }
}

private actor ConnectionHealth {
    var joined = false
    var pending: String?
    func accept(_ event: SocialRealtimeProtocol.Event) {
        if event == .joined { joined = true }
        if case .heartbeat(let ref) = event, pending == ref { pending = nil }
    }
    func nextHeartbeat() throws -> String {
        guard joined, pending == nil else { throw CampusError.invalidResponse }
        let ref = UUID().uuidString; pending = ref; return ref
    }
}

public enum SocialRealtimeConnection {
    /// Cancelling the caller closes the socket, including an outstanding receive.
    public static func run(socket: any SocialSocket, owner: UUID,
                           heartbeatInterval: Duration = .seconds(20),
                           token: @escaping @Sendable () async throws -> String,
                           changed: @escaping @Sendable () async -> Void) async throws {
        let wire = SocialRealtimeProtocol(owner: owner), health = ConnectionHealth()
        try await withTaskCancellationHandler {
            defer { socket.close() }
            try Task.checkCancellation()
            try await socket.send(wire.join(token: try await token()))
            try await withThrowingTaskGroup(of: Void.self) { group in
                group.addTask {
                    while !Task.isCancelled {
                        let event = try wire.receive(try await socket.receive())
                        try Task.checkCancellation()
                        await health.accept(event)
                        if event == .joined || event == .changed { await changed() }
                    }
                }
                group.addTask {
                    while !Task.isCancelled {
                        try await Task.sleep(for: heartbeatInterval)
                        let ref = try await health.nextHeartbeat()
                        try await socket.send(wire.heartbeat(ref: ref))
                        try await socket.send(wire.updateToken(try await token()))
                    }
                }
                defer { group.cancelAll(); socket.close() }
                try await group.next()
            }
        } onCancel: { socket.close() }
    }
}

/// Buffers one refresh while a screen is loading. Observers disappear with their view task.
@MainActor public final class SocialInvalidationHub {
    private var listeners: [UUID: AsyncStream<Void>.Continuation] = [:]
    public init() {}
    public var observerCount: Int { listeners.count }
    public func updates() -> AsyncStream<Void> {
        let id = UUID()
        return AsyncStream(bufferingPolicy: .bufferingNewest(1)) { continuation in
            listeners[id] = continuation
            continuation.yield(())
            continuation.onTermination = { [weak self] _ in Task { @MainActor in self?.listeners.removeValue(forKey: id) } }
        }
    }
    public func invalidate() { for listener in listeners.values { listener.yield(()) } }
    public func finish() { let previous = listeners; listeners.removeAll(); for listener in previous.values { listener.finish() } }
}
