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
    let api: CampusAPI?
    let website: URL?
    private var didRestore = false
    private let appAttest = AppAttestClient()

    init() {
        appearance = Appearance(rawValue: UserDefaults.standard.string(forKey: "appearance") ?? "colorful") ?? .colorful
        let raw = Bundle.main.object(forInfoDictionaryKey: "CampusMintServerURL") as? String ?? ""
        website = URL(string: raw)
        if let website {
            api = try? CampusAPI(baseURL: website, vault: KeychainSessionVault(service: Bundle.main.bundleIdentifier ?? "com.campusmint.app"))
        } else { api = nil }
    }

    var accent: Color { Color(red: 0.16, green: 0.56, blue: 0.38) }
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
        guard account != nil, let api, !busy else { return }
        do { try accept(try await api.account()) }
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
        guard let api, account != nil else { return }
        do {
            let result = try await api.feed()
            posts = result.mintz
            authors = Dictionary(result.authors.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        } catch {
            clearAccountIfSessionEnded(error)
            message = error.localizedDescription
        }
    }

    func publish(text: String, requestID: UUID) async throws {
        guard let api, canPublish, let configuration else { throw CampusError.featureUnavailable }
        let post = try TextPostRequest(caption: text, requestID: requestID)
        let body = try JSONEncoder().encode(post)
        var headers: [String: String] = [:]
        if configuration.appAttestRequired && !configuration.appAttestEnabled { throw CampusError.featureUnavailable }
        if configuration.appAttestEnabled {
            guard let account else { throw CampusError.signedOut }
            headers = try await appAttest.headers(api: api, userID: account.id, method: "POST", path: "/api/mintz", body: body)
        }
        do { try await api.publishEncoded(body, additionalHeaders: headers) }
        catch {
            clearAccountIfSessionEnded(error)
            throw error
        }
        await refreshFeed()
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
