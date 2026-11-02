import Foundation

/// Session-bounded positive signals, using the same dwell formula as the web.
/// Scrolling past a post never creates negative feedback.
public struct FeedLearning: Sendable {
    public struct Pending: Sendable, Equatable {
        public let post: UUID, weight: Double, updatedAt: Date
    }
    private struct Record: Sendable { var seconds: Double = 0; var appreciated = false; var endorsed = false; var sent: Double = 0; var pending: Pending? }
    private var records: [UUID: Record] = [:]
    private var order: [UUID] = []
    public init() {}
    public mutating func observe(post: UUID, seconds: Double, now: Date = Date()) {
        guard seconds.isFinite, seconds > 0, seconds <= 5 else { return }
        if records[post] == nil { order.append(post) }
        if order.count > 500 { records.removeValue(forKey: order.removeFirst()) }
        var record = records[post] ?? Record()
        record.seconds = min(120, record.seconds + seconds)
        update(&record, post: post, now: now)
        records[post] = record
    }
    public mutating func interaction(post: UUID, appreciated: Bool, endorsed: Bool, now: Date = Date()) {
        if records[post] == nil { order.append(post) }
        if order.count > 500 { records.removeValue(forKey: order.removeFirst()) }
        var record = records[post] ?? Record()
        record.appreciated = appreciated; record.endorsed = endorsed
        update(&record, post: post, now: now); records[post] = record
    }
    private func update(_ record: inout Record, post: UUID, now: Date) {
        let dwell = record.seconds >= 8 ? log2(1 + record.seconds / 8) : 0
        let weight = min(4, dwell + (record.appreciated ? 2 : 0) + (record.endorsed ? 3 : 0))
        if weight > 0 && weight >= record.sent + 0.25 {
            record.pending = .init(post: post, weight: weight, updatedAt: now)
        }
    }
    public var batch: [Pending] {
        Array(records.values.compactMap(\.pending).sorted { $0.updatedAt < $1.updatedAt }.prefix(50))
    }
    public mutating func acknowledge(_ sent: [Pending]) {
        for item in sent {
            guard var current = records[item.post] else { continue }
            current.sent = max(current.sent, item.weight)
            if (current.pending?.weight ?? 0) <= current.sent { current.pending = nil }
            records[item.post] = current
        }
    }
}

public struct FeedLearningWrite: Encodable, Sendable {
    public let signals: [FeedPreferenceWrite.Signal]
    public init(_ batch: [FeedLearning.Pending]) throws {
        guard !batch.isEmpty, batch.count <= 50 else { throw CampusError.configuration }
        signals = try batch.map { try FeedPreferenceWrite(post: $0.post, weight: $0.weight, now: $0.updatedAt).signals[0] }
    }
}
