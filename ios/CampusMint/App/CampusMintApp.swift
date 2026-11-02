import SwiftUI
import CampusMintCore

@main
struct CampusMintApp: App {
    @StateObject private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .tint(model.accent)
                .preferredColorScheme(model.appearance.colorScheme)
                .privacySensitive()
                .overlay {
                    if scenePhase != .active { Color(.systemBackground).ignoresSafeArea() }
                }
                .task { await model.restore() }
                .task(id: scenePhase == .active ? model.account?.id : nil) {
                    guard scenePhase == .active else { return }
                    await model.runSocialSync()
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { Task { await model.refreshAccountIfSignedIn() } }
                }
        }
    }
}

@MainActor
final class AppModel: ObservableObject {
    @Published var account: CampusUser? {
        didSet { if oldValue?.id != account?.id {
            socialChanges.finish(); feedGeneration = UUID(); feedLearning = FeedLearning()
            nextFeedCursor = nil; feedHasLoadedMore = false; posts = []; authors = [:]; feedLoading = false; feedError = nil
        } }
    }
    let socialChanges = SocialInvalidationHub()
    @Published var feedLoading = false
    @Published var nextFeedCursor: String?
    @Published var feedError: String?
    private var feedHasLoadedMore = false
    private var feedGeneration = UUID()
    private var feedLearning = FeedLearning()
    private var learningWriteOwner: UUID?
    @Published var posts: [MintPost] = []
    @Published var authors: [UUID: CampusUser] = [:]
    @Published var canUseCampusTester = false
    @Published var pendingStudent: AccountResponse?
    @Published var isRestoring = true
    @Published var busy = false
    @Published var message: String?
    @Published var configuration: NativeConfig?
    @Published var appearance: Appearance {
        didSet { UserDefaults.standard.set(appearance.rawValue, forKey: "appearance") }
    }
    @Published var accentSelection: CampusAccent {
        didSet { UserDefaults.standard.set(accentSelection.rawValue, forKey: "accentSelection") }
    }
    var schoolAccent: Int { campusAccentColors[account?.account.universityId ?? "tamu"] ?? 0x6f1d2c }
    @Published var highQualityUploads = UserDefaults.standard.bool(forKey: "highQualityUploads") {
        didSet { UserDefaults.standard.set(highQualityUploads, forKey: "highQualityUploads") }
    }
    @Published var commentsDefault = UserDefaults.standard.object(forKey: "commentsDefault") as? Bool ?? true {
        didSet { UserDefaults.standard.set(commentsDefault, forKey: "commentsDefault") }
    }
    @Published var autoplayVideo = UserDefaults.standard.object(forKey: "autoplayVideo") as? Bool ?? true {
        didSet { UserDefaults.standard.set(autoplayVideo, forKey: "autoplayVideo") }
    }
    @Published var reduceMotion = UserDefaults.standard.bool(forKey: "reduceMotion") {
        didSet { UserDefaults.standard.set(reduceMotion, forKey: "reduceMotion") }
    }
    let drafts = DraftStore(root: URL.applicationSupportDirectory.appendingPathComponent("MintDrafts", isDirectory: true))
    let api: CampusAPI?
    let website: URL?
    private var didRestore = false
    private let appAttest = AppAttestClient()

    init() {
        appearance = Appearance(rawValue: UserDefaults.standard.string(forKey: "appearance") ?? "light") ?? .light
        accentSelection = CampusAccent(rawValue: UserDefaults.standard.string(forKey: "accentSelection") ?? "campus") ?? .campus
        let raw = Bundle.main.object(forInfoDictionaryKey: "CampusMintServerURL") as? String ?? ""
        website = URL(string: raw)
        if let website {
            api = try? CampusAPI(baseURL: website, vault: KeychainSessionVault(service: Bundle.main.bundleIdentifier ?? "com.campusmint.app"))
        } else { api = nil }
    }

    var accent: Color {
        let appearance = appearance, selection = accentSelection, school = schoolAccent
        return Color(uiColor: UIColor { traits in
            UIColor(CampusPalette.resolve(appearance, system: traits.userInterfaceStyle == .dark ? .dark : .light, selection: selection, school: school).accent)
        })
    }
    var canPublish: Bool { account?.account.verifiedStudent == true && configuration?.apiVersion == 1 }

    func restore() async {
        guard !didRestore else { return }
        didRestore = true
        defer { isRestoring = false }
        guard let api else { message = CampusError.configuration.localizedDescription; return }
        do {
            if let restored = try await api.restore() {
                configuration = try await api.configuration()
                try accept(restored)
                await refreshFeed()
            }
        } catch { message = error.localizedDescription }
    }

    func refreshAccountIfSignedIn() async {
        guard let expected = account?.id, let api, !busy else { return }
        do {
            let restored = try await api.account()
            guard account?.id == expected else { return }
            try accept(restored)
        }
        catch {
            clearAccountIfSessionEnded(error)
            message = error.localizedDescription
        }
    }

    func requestCode(_ email: String) async throws {
        guard let api else { throw CampusError.configuration }
        // Confirm this server supports the native API before requesting a real sign-in email.
        configuration = try await api.configuration()
        try await api.requestCode(email: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())
    }

    func signIn(email: String, code: String) async throws {
        guard let api else { throw CampusError.configuration }
        try accept(try await api.verifyCode(email: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), code: code))
        configuration = try await api.configuration()
        await refreshFeed()
    }

    func requestStudentSignup(_ email: String) async throws {
        guard let api else { throw CampusError.configuration }; configuration = try await api.configuration()
        try await api.requestStudentSignupCode(email: email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())
    }
    func verifyStudentSignup(email: String, code: String) async throws {
        guard let api else { throw CampusError.configuration }; try accept(try await api.verifyStudentSignup(email: email, code: code)); await refreshFeed()
    }
    func finishStudentSignup(_ profile: StudentSignup) async throws {
        guard let api, let owner = pendingStudent?.authUserId, let configuration else { throw CampusError.signedOut }
        if configuration.appAttestRequired && !configuration.appAttestEnabled { throw CampusError.featureUnavailable }
        let data = try JSONEncoder().encode(profile)
        let headers = configuration.appAttestEnabled ? try await appAttest.headers(api: api, userID: owner, method: "POST", path: "/api/account/complete", body: data) : [:]
        guard pendingStudent?.authUserId == owner else { throw CampusError.signedOut }
        try accept(try await api.completeStudentSignupEncoded(data, owner: owner, additionalHeaders: headers)); await refreshFeed()
    }

    private func accept(_ result: AccountResponse) throws {
        canUseCampusTester = result.canUseCampusTester == true
        if result.accountType == "student", result.onboardingComplete == false, result.user == nil, result.authUserId != nil, result.studentSetup != nil { pendingStudent = result; account = nil; return }
        guard result.onboardingComplete == true, let user = result.user, user.account.verifiedStudent else {
            throw CampusError.unsupportedAccount
        }
        pendingStudent = nil; account = user
    }

    func refreshFeed(reconcile: Bool = false) async {
        guard let api, let expected = account?.id else { return }
        if reconcile && feedLoading { return }
        let ticket = UUID(); feedGeneration = ticket; feedLoading = true; feedError = nil
        let previous = posts, previousCursor = nextFeedCursor
        defer { if feedGeneration == ticket { feedLoading = false } }
        do {
            let result = try await api.feedPage(owner: expected)
            var refreshed = result.mintz, refreshedAuthors = result.authors
            if reconcile {
                let freshIDs = Set(refreshed.map(\.id))
                let older = previous.filter { !freshIDs.contains($0.id) }.compactMap { UUID(uuidString: $0.id) }
                // Reauthorize loaded history as well as new posts; a privacy change
                // must remove an older card instead of leaving a stale local copy.
                for index in stride(from: 0, to: older.count, by: 50) {
                    guard account?.id == expected, feedGeneration == ticket else { return }
                    let page = try await api.feed(ids: Array(older[index..<min(index+50, older.count)]), ranked: true)
                    refreshed += page.mintz; refreshedAuthors += page.authors
                }
            }
            guard account?.id == expected, feedGeneration == ticket, !Task.isCancelled else { return }
            posts = refreshed; authors = Dictionary(refreshedAuthors.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
            nextFeedCursor = reconcile && feedHasLoadedMore ? previousCursor : result.nextCursor
            if !reconcile { feedHasLoadedMore = false }
        } catch {
            guard account?.id == expected, feedGeneration == ticket, !Task.isCancelled else { return }
            clearAccountIfSessionEnded(error); feedError = error.localizedDescription
            if reconcile { posts = []; authors = [:]; nextFeedCursor = nil }
        }
    }

    func loadMoreFeed() async {
        guard let api, let owner = account?.id, let cursor = nextFeedCursor, !feedLoading else { return }
        let ticket = feedGeneration; feedLoading = true; feedError = nil
        defer { if ticket == feedGeneration { feedLoading = false } }
        do {
            let page = try await api.feedPage(cursor: cursor, owner: owner)
            guard account?.id == owner, ticket == feedGeneration, !Task.isCancelled else { return }
            let existing = Set(posts.map(\.id)); posts += page.mintz.filter { !existing.contains($0.id) }
            for author in page.authors { authors[author.id] = author }
            nextFeedCursor = page.nextCursor; feedHasLoadedMore = true
        } catch {
            guard ticket == feedGeneration, account?.id == owner else { return }
            clearAccountIfSessionEnded(error); feedError = error.localizedDescription
        }
    }

    func recordReading(post: MintPost, seconds: Double) {
        guard let owner = account?.id, post.authorId != owner, let id = UUID(uuidString: post.id) else { return }
        feedLearning.observe(post: id, seconds: seconds)
    }
    func recordPostInteraction(post: UUID, appreciated: Bool, endorsed: Bool) {
        guard let owner = account?.id else { return }
        if posts.first(where: { UUID(uuidString: $0.id) == post })?.authorId == owner { return }
        feedLearning.interaction(post: post, appreciated: appreciated, endorsed: endorsed)
    }
    func flushReading() async {
        guard let owner = account?.id, learningWriteOwner == nil else { return }
        let batch = feedLearning.batch; guard !batch.isEmpty else { return }
        learningWriteOwner = owner
        defer { learningWriteOwner = nil }
        do {
            let body = try JSONEncoder().encode(FeedLearningWrite(batch))
            _ = try await writeCampus(.preference, body: body, owner: owner, invalidate: false)
            guard account?.id == owner else { return }; feedLearning.acknowledge(batch)
        } catch { /* Keep the bounded batch for the next foreground retry. */ }
    }

    func publish(draft: ComposerDraft, owner: UUID) async throws {
        guard let api, canPublish, let configuration else { throw CampusError.featureUnavailable }
        guard account?.id == owner else { throw CampusError.signedOut }
        let post = try TextPostRequest(caption: draft.caption, requestID: draft.requestID, privacy: draft.privacy, expiresAt: draft.expiresAt, poll: draft.poll, media: draft.media, context: draft.context, mentions: draft.mentions ?? [], commentsEnabled: draft.commentsEnabled ?? true)
        func headers(_ body: Data) async throws -> [String: String] {
            guard account?.id == owner else { throw CampusError.signedOut }
            if configuration.appAttestRequired && !configuration.appAttestEnabled { throw CampusError.featureUnavailable }
            return configuration.appAttestEnabled ? try await appAttest.headers(api: api, userID: owner, method: "POST", path: "/api/mintz", body: body) : [:]
        }
        do {
            var body = try JSONEncoder().encode(post)
            if !draft.media.isEmpty {
                guard let storage = configuration.storageURL, let origin = URL(string: storage) else { throw CampusError.invalidPost("Media uploads need the latest server update. Your draft is saved.") }
                let prepare = try JSONEncoder().encode(PrepareUploadRequest(post: post, files: draft.media))
                let signed = try await headers(prepare)
                guard account?.id == owner else { throw CampusError.signedOut }
                let response = try await api.prepareUploadEncoded(prepare, additionalHeaders: signed, owner: owner)
                if response.mint != nil { await refreshFeed(); return }
                guard let upload = response.upload, !upload.ticket.isEmpty, upload.files.count == draft.media.count else { throw CampusError.invalidResponse }
                for (index, media) in draft.media.enumerated() {
                    guard account?.id == owner else { throw CampusError.signedOut }
                    let url = try await drafts.mediaURL(owner: owner, draft: draft.id, media: media)
                    try await api.uploadMedia(origin: origin, destination: upload.files[index], owner: owner, requestID: draft.requestID, index: index, media: media, file: url)
                }
                body = try JSONEncoder().encode(CompleteUploadRequest(post: post, ticket: upload.ticket))
            }
            let signed = try await headers(body)
            guard account?.id == owner else { throw CampusError.signedOut }
            try await api.publishEncoded(body, additionalHeaders: signed, owner: owner)
        } catch { clearAccountIfSessionEnded(error); throw error }
        await refreshFeed()
    }

    func vote(post: UUID, option: String) async throws -> MintPoll {
        guard let api, let account, let configuration else { throw CampusError.signedOut }
        struct Vote: Encodable { let optionId: String }
        let body = try JSONEncoder().encode(Vote(optionId: option))
        let path = "/api/mintz/\(post.uuidString.lowercased())/poll"
        if configuration.appAttestRequired && !configuration.appAttestEnabled { throw CampusError.featureUnavailable }
        let headers = configuration.appAttestEnabled ? try await appAttest.headers(api: api, userID: account.id, method: "POST", path: path, body: body) : [:]
        guard self.account?.id == account.id else { throw CampusError.signedOut }
        do { return try await api.votePollEncoded(id: post, body: body, additionalHeaders: headers) }
        catch { clearAccountIfSessionEnded(error); throw error }
    }

    func runSocialSync() async {
        guard let owner = account?.id, let api else { return }
        socialChanges.invalidate()
        await withTaskGroup(of: Void.self) { group in
            group.addTask { [weak self] in
                while !Task.isCancelled {
                    do { try await Task.sleep(for: .seconds(30)) } catch { return }
                    await self?.flushReading()
                }
            }
            group.addTask { [weak self] in
                while !Task.isCancelled {
                    do { try await Task.sleep(for: .seconds(30)) } catch { return }
                    await self?.invalidateSocial(owner: owner)
                }
            }
            group.addTask { [weak self] in
                while !Task.isCancelled {
                    do {
                        let config = try await api.configuration()
                        if let realtime = config.realtime {
                            try await api.observeSocialChanges(owner: owner, configuration: realtime) { [weak self] in
                                await self?.invalidateSocial(owner: owner)
                            }
                        }
                    } catch {
                        if !Task.isCancelled { await self?.handleSocialSyncFailure(error, owner: owner) }
                    }
                    do { try await Task.sleep(for: .seconds(30)) } catch { return }
                }
            }
            await group.waitForAll()
        }
    }

    private func invalidateSocial(owner: UUID) {
        guard account?.id == owner, !Task.isCancelled else { return }
        socialChanges.invalidate()
    }

    private func handleSocialSyncFailure(_ error: Error, owner: UUID) {
        guard account?.id == owner else { return }
        clearAccountIfSessionEnded(error)
    }

    func writeCampus(_ endpoint: CampusWrite, body: Data, owner: UUID, invalidate: Bool = true) async throws -> CampusWriteResult {
        guard let api, account?.id == owner, let configuration else { throw CampusError.signedOut }
        if configuration.appAttestRequired && !configuration.appAttestEnabled { throw CampusError.featureUnavailable }
        let headers = configuration.appAttestEnabled ? try await appAttest.headers(api: api, userID: owner, method: endpoint.method, path: endpoint.path, body: body) : [:]
        guard account?.id == owner else { throw CampusError.signedOut }
        do {
            let result = try await api.mutateCampus(endpoint, body: body, owner: owner, additionalHeaders: headers)
            guard account?.id == owner else { throw CampusError.signedOut }
            if invalidate { socialChanges.invalidate() }
            return result
        } catch { if account?.id == owner { clearAccountIfSessionEnded(error) }; throw error }
    }

    func mutateSocial(_ mutation: SocialMutation) async throws {
        guard let api, let account, let configuration else { throw CampusError.signedOut }
        let body = try JSONEncoder().encode(mutation)
        var headers: [String:String] = [:]
        if configuration.appAttestRequired && !configuration.appAttestEnabled { throw CampusError.featureUnavailable }
        if configuration.appAttestEnabled {
            headers = try await appAttest.headers(api: api, userID: account.id, method: "POST", path: "/api/social", body: body)
        }
        do {
            try await api.mutateSocialEncoded(body, additionalHeaders: headers, owner: account.id)
            guard self.account?.id == account.id else { throw CampusError.signedOut }
            socialChanges.invalidate()
        }
        catch {
            if self.account?.id == account.id { clearAccountIfSessionEnded(error) }
            throw error
        }
    }

    private func clearAccountIfSessionEnded(_ error: Error) {
        switch error {
        case CampusError.signedOut, CampusError.invalidSession, CampusError.identityMismatch:
            account = nil; canUseCampusTester = false; pendingStudent = nil; posts = []; authors = [:]
        default: break
        }
    }

    func signOut() async {
        guard let api else { return }
        busy = true
        defer { busy = false }
        account = nil; canUseCampusTester = false; pendingStudent = nil; posts = []; authors = [:]; message = nil
        do { try await api.signOut() } catch { message = error.localizedDescription }
    }
}

enum Appearance: String, CaseIterable, Identifiable {
    case light, dark, colorful
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
    var colorScheme: ColorScheme? {
        switch self { case .light: .light; case .dark: .dark; case .colorful: nil }
    }
}
