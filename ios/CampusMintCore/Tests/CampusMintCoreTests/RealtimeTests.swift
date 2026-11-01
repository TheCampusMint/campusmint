import Foundation
import CampusMintCore

private let syncOwner = UUID(uuidString: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")!
private func frame(_ event: String, topic: String? = nil, ref: String = "join", payload: [String: Any]) throws -> String {
    String(decoding: try JSONSerialization.data(withJSONObject: ["event": event, "topic": topic ?? SocialRealtimeProtocol(owner: syncOwner).topic, "ref": ref, "payload": payload]), as: UTF8.self)
}

func realtimeOnlyConnectsToSecureProjectOrigins() throws {
    for origin in ["http://project.supabase.co", "https://project.supabase.co.evil.com", "https://x:y@project.supabase.co", "https://project.supabase.co/path", "https://project.supabase.co?secret=x", "https://project.supabase.co:8443"] {
        let config = try JSONDecoder().decode(SocialRealtimeConfiguration.self, from: JSONSerialization.data(withJSONObject: ["url": origin, "publishableKey": "sb_publishable_test"]))
        try expectThrows(CampusError.configuration) { try config.socketURL() }
    }
    let config = try JSONDecoder().decode(SocialRealtimeConfiguration.self, from: Data(#"{"url":"https://project.supabase.co","publishableKey":"sb_publishable_test"}"#.utf8))
    let url = try config.socketURL()
    try expect(url.scheme == "wss" && url.path == "/realtime/v1/websocket")
    try expect(URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "vsn" })?.value == "1.0.0")
    // Old server config is backwards compatible: HTTP fallback works until the server upgrades.
    let old = try JSONDecoder().decode(NativeConfig.self, from: Data(#"{"apiVersion":1,"appleLinkingEnabled":false,"appAttestEnabled":false,"appAttestRequired":false}"#.utf8))
    try expect(old.realtime == nil)
}

func realtimeFiltersForeignAccountsAndPrivateTables() throws {
    let wire = SocialRealtimeProtocol(owner: syncOwner)
    let joined = try require(try JSONSerialization.jsonObject(with: Data(wire.join(token: "access").utf8)) as? [String: Any])
    let payload = try require(joined["payload"] as? [String: Any])
    let config = try require(payload["config"] as? [String: Any])
    let changes = try require(config["postgres_changes"] as? [[String: String]])
    try expect(changes.count == 1 && changes[0]["table"] == "social_sync_revisions" && changes[0]["filter"] == "user_id=eq.\(syncOwner.uuidString.lowercased())")
    try expect(payload["access_token"] as? String == "access")
    func change(owner: UUID, table: String = "social_sync_revisions", topic: String? = nil) throws -> String {
        try frame("postgres_changes", topic: topic, payload: ["data": ["schema": "public", "table": table, "record": ["user_id": owner.uuidString, "revision": 2]]])
    }
    try expect(try wire.receive(change(owner: syncOwner)) == .changed)
    try expect(try wire.receive(change(owner: UUID())) == .ignored)
    try expect(try wire.receive(change(owner: syncOwner, table: "direct_messages")) == .ignored)
    try expect(try wire.receive(change(owner: syncOwner, topic: "other")) == .ignored)
    try expectThrows(CampusError.invalidResponse) { try wire.receive(frame("phx_error", payload: [:])) }
    try expectThrows(CampusError.invalidResponse) { try wire.receive(frame("phx_reply", payload: ["status": "error"])) }
    try expectThrows(CampusError.invalidResponse) { try wire.receive(String(repeating: "x", count: 65_537)) }
}

private final class FakeSocialSocket: SocialSocket, @unchecked Sendable {
    // All mutable test transport state is lock-protected; close must synchronously unblock receive.
    private let lock = NSLock()
    private var messages: [String]
    private var waiting: CheckedContinuation<String, Error>?
    private var closed = false
    private var sent: [String] = []
    init(_ messages: [String]) { self.messages = messages }
    var isClosed: Bool { lock.withLock { closed } }
    var sends: [String] { lock.withLock { sent } }
    func send(_ text: String) async throws { try lock.withLock { if closed { throw CancellationError() }; sent.append(text) } }
    func receive() async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            lock.withLock {
                if closed { continuation.resume(throwing: CancellationError()) }
                else if !messages.isEmpty { continuation.resume(returning: messages.removeFirst()) }
                else { waiting = continuation }
            }
        }
    }
    func close() { lock.withLock { closed = true; waiting?.resume(throwing: CancellationError()); waiting = nil } }
}
private actor Counter {
    var value = 0
    func increment() { value += 1 }
}
private func waitUntil(_ check: () async -> Bool) async throws {
    for _ in 0..<100 { if await check() { return }; try await Task.sleep(for: .milliseconds(10)) }
    throw CheckFailure(description: "Realtime check timed out")
}

func realtimeCancellationClosesPendingReceive() async throws {
    let socket = FakeSocialSocket([try frame("phx_reply", payload: ["status": "ok"])])
    let changes = Counter()
    let task = Task { try await SocialRealtimeConnection.run(socket: socket, owner: syncOwner, token: { "access" }, changed: { await changes.increment() }) }
    try await waitUntil { await changes.value == 1 }
    task.cancel()
    _ = await task.result
    try expect(socket.isClosed)
    try expect(await changes.value == 1)
}

func realtimeMissedHeartbeatForcesReconnect() async throws {
    let socket = FakeSocialSocket([try frame("phx_reply", payload: ["status": "ok"])])
    let tokens = Counter()
    try await expectThrows(CampusError.invalidResponse) {
        try await SocialRealtimeConnection.run(socket: socket, owner: syncOwner, heartbeatInterval: .milliseconds(10), token: {
            await tokens.increment(); return "refreshed-access"
        }, changed: {})
    }
    try expect(socket.isClosed)
    try expect(await tokens.value >= 2)
    try expect(socket.sends.contains { $0.contains("access_token") && $0.contains("refreshed-access") })
    let notJoined = FakeSocialSocket([])
    try await expectThrows(CampusError.invalidResponse) {
        try await SocialRealtimeConnection.run(socket: notJoined, owner: syncOwner, heartbeatInterval: .milliseconds(10), token: { "access" }, changed: {})
    }
    try expect(notJoined.isClosed)
}

func realtimeRevokedSessionStopsConnection() async throws {
    let socket = FakeSocialSocket([try frame("phx_reply", payload: ["status": "ok"])])
    let tokens = Counter()
    try await expectThrows(CampusError.signedOut) {
        try await SocialRealtimeConnection.run(socket: socket, owner: syncOwner, heartbeatInterval: .milliseconds(10), token: {
            await tokens.increment()
            if await tokens.value > 1 { throw CampusError.signedOut }
            return "access"
        }, changed: {})
    }
    try expect(socket.isClosed)
}

@MainActor func invalidationsCoalesceAndEndWithAccount() async throws {
    let hub = SocialInvalidationHub()
    var first = hub.updates().makeAsyncIterator(), second = hub.updates().makeAsyncIterator()
    try expect(hub.observerCount == 2)
    try expect(await first.next() != nil)
    try expect(await second.next() != nil)
    for _ in 0..<100 { hub.invalidate() }
    hub.finish()
    try expect(hub.observerCount == 0)
    try expect(await first.next() != nil)
    try expect(await first.next() == nil)
    try expect(await second.next() != nil)
    try expect(await second.next() == nil)
}

private struct TestRow: SocialRow { let id: UUID; let pageDate: String }
private actor Pages {
    var cursors: [UUID?] = []
    var pages: [SocialPage<TestRow>]
    init(_ ids: [[UUID]]) throws {
        pages = try ids.enumerated().map { index, ids in
            try JSONDecoder().decode(SocialPage<TestRow>.self, from: JSONSerialization.data(withJSONObject: ["ok": true, "hasMore": index == 0, "items": ids.map { ["id": $0.uuidString, "pageDate": "2026-10-30"] }]))
        }
    }
    func fetch(_ cursor: SocialCursor?) throws -> SocialPage<TestRow> {
        cursors.append(cursor?.id)
        guard !pages.isEmpty else { throw CampusError.invalidResponse }
        return pages.removeFirst()
    }
}
func socialRefreshReconcilesLoadedHistory() async throws {
    let old = UUID(), newest = UUID(), retained = UUID(), oldest = UUID()
    let pages = try Pages([[newest, retained], [oldest]])
    let previous = [TestRow(id: old, pageDate: "2026-10-29"), TestRow(id: retained, pageDate: "2026-10-29")]
    let refreshed = try await SocialPageSnapshot.load(previous: previous, loadedPages: 2, older: false) { try await pages.fetch($0) }
    try expect(refreshed.rows.map(\.id) == [newest, retained, oldest])
    try expect(!refreshed.rows.contains { $0.id == old })
    try expect(await pages.cursors == [nil, retained])
    let older = try Pages([[oldest, old]])
    let appended = try await SocialPageSnapshot.load(previous: refreshed.rows, loadedPages: 2, older: true) { try await older.fetch($0) }
    try expect(appended.rows.map(\.id) == [newest, retained, oldest, old])
    try expect(appended.loadedPages == 3)
}
