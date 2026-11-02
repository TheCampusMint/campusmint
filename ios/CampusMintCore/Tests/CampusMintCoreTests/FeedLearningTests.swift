import Foundation
import CampusMintCore

func readingSignalsIgnoreIncidentalExposureAndBoundMemory() throws {
    var learning = FeedLearning(); let id = UUID(), now = Date(timeIntervalSince1970: 100)
    for _ in 0..<7 { learning.observe(post: id, seconds: 1, now: now) }
    try expect(learning.batch.isEmpty)
    for seconds in [Double.nan, .infinity, -1, 0, 60] { learning.observe(post: id, seconds: seconds, now: now) }
    try expect(learning.batch.isEmpty)
    learning.observe(post: id, seconds: 1, now: now)
    let first = learning.batch; try expect(first.count == 1 && first[0].weight == 1)
    for _ in 0..<120 { learning.observe(post: id, seconds: 1, now: now) }
    try expect(learning.batch.first?.weight == 4)
    learning.acknowledge(first); try expect(learning.batch.first?.weight == 4)
    learning.acknowledge(learning.batch); try expect(learning.batch.isEmpty)
    learning.observe(post: id, seconds: 1); try expect(learning.batch.isEmpty)
    for _ in 0..<550 { let post = UUID(); learning.observe(post: post, seconds: 4); learning.observe(post: post, seconds: 4) }
    var count=0
    while !learning.batch.isEmpty { let batch=learning.batch; try expect(batch.count<=50); count+=batch.count; learning.acknowledge(batch) }
    try expect(count==500)
}
func readingSignalsEncodeOnlyBoundedPositiveFeedback() throws {
    var learning=FeedLearning(); let id=UUID()
    learning.observe(post:id,seconds:4);learning.observe(post:id,seconds:4)
    let data=try JSONEncoder().encode(FeedLearningWrite(learning.batch))
    let json=try require(JSONSerialization.jsonObject(with:data) as? [String:Any])
    let signal=try require((json["signals"] as? [[String:Any]])?.first)
    try expect(signal["weight"] as? Double == 1 && signal["reason"] is NSNull)
    try expect(signal["userId"] == nil && signal["authorId"] == nil)
    try expectThrows(CampusError.configuration) { try FeedLearningWrite([]) }
}

func readingAndAppreciationCombineWithoutNegativeSkipSignals() throws {
    var learning=FeedLearning(); let id=UUID()
    learning.interaction(post:id,appreciated:true,endorsed:false)
    try expect(learning.batch.first?.weight==2); learning.acknowledge(learning.batch)
    for _ in 0..<8 { learning.observe(post:id,seconds:1) }
    try expect(learning.batch.first?.weight==3)
    learning.interaction(post:id,appreciated:true,endorsed:true)
    try expect(learning.batch.first?.weight==4); learning.acknowledge(learning.batch)
    learning.interaction(post:id,appreciated:false,endorsed:false)
    try expect(learning.batch.isEmpty)
}
