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
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { Task { await model.refreshAccountIfSignedIn() } }
                }
        }
    }
}

@MainActor
final class AppModel: ObservableObject {
    @Published var account: CampusUser?
    @Published var posts: [MintPost] = []
    @Published var authors: [UUID: CampusUser] = [:]
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

    private func accept(_ result: AccountResponse) throws {
        guard result.onboardingComplete == true, let user = result.user, user.account.verifiedStudent else {
            throw CampusError.unsupportedAccount
        }
        account = user
    }

    func refreshFeed() async {
        guard let api, let expected = account?.id else { return }
        do {
            let result = try await api.feed()
            guard account?.id == expected else { return }
            posts = result.mintz
            authors = Dictionary(result.authors.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        } catch {
            clearAccountIfSessionEnded(error)
            message = error.localizedDescription
        }
    }

    func publish(draft: ComposerDraft, owner: UUID) async throws {
        guard let api, canPublish, let configuration else { throw CampusError.featureUnavailable }
        guard account?.id == owner else { throw CampusError.signedOut }
        let post = try TextPostRequest(caption: draft.caption, requestID: draft.requestID, privacy: draft.privacy, expiresAt: draft.expiresAt, poll: draft.poll, media: draft.media)
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
                let response = try await api.prepareUploadEncoded(prepare, additionalHeaders: signed)
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
            try await api.publishEncoded(body, additionalHeaders: signed)
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

    func mutateSocial(_ mutation: SocialMutation) async throws {
        guard let api, let account, let configuration else { throw CampusError.signedOut }
        let body = try JSONEncoder().encode(mutation)
        var headers: [String:String] = [:]
        if configuration.appAttestRequired && !configuration.appAttestEnabled { throw CampusError.featureUnavailable }
        if configuration.appAttestEnabled {
            headers = try await appAttest.headers(api: api, userID: account.id, method: "POST", path: "/api/social", body: body)
        }
        do { try await api.mutateSocialEncoded(body, additionalHeaders: headers) }
        catch { clearAccountIfSessionEnded(error); throw error }
    }

    private func clearAccountIfSessionEnded(_ error: Error) {
        switch error {
        case CampusError.signedOut, CampusError.invalidSession, CampusError.identityMismatch:
            account = nil; posts = []; authors = [:]
        default: break
        }
    }

    func signOut() async {
        guard let api else { return }
        busy = true
        defer { busy = false }
        account = nil; posts = []; authors = [:]; message = nil
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
