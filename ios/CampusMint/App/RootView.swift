import SwiftUI
import CampusMintCore

struct RootView: View {
    @Environment(\.colorScheme) private var systemScheme
    @EnvironmentObject private var model: AppModel
    var body: some View {
        Group {
            if model.isRestoring {
                ProgressView("Campus Mint")
            } else if model.account == nil {
                AccountEntryView()
            } else {
                CampusShell().id(model.account?.id)
            }
        }
        .environment(\.campusPalette, palette)
        .font(CampusFont.regular(16))
        .foregroundStyle(palette.text)
        .tint(palette.accent)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(palette.background.ignoresSafeArea())
        .alert("Campus Mint", isPresented: Binding(get: { model.message != nil }, set: { if !$0 { model.message = nil } })) {
            Button("OK") { model.message = nil }
        } message: { Text(model.message ?? "") }
    }
    private var palette: CampusPalette { .resolve(model.appearance, system: systemScheme, selection: model.accentSelection, school: model.schoolAccent) }

}

struct AccountEntryView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    @State private var signingIn = false
    var body: some View {
        if signingIn { SignInView(onBack: { signingIn = false }) }
        else {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Text("THE CAMPUS MINT").font(CampusFont.black(10, relativeTo: .caption2)).tracking(1.8).foregroundStyle(palette.accent)
                    Text("Choose your\naccount").font(CampusFont.black(36, relativeTo: .largeTitle)).tracking(-1.62).padding(.top, 12)
                    Button { signingIn = true } label: {
                        Text("Sign In").font(CampusFont.black(16)).frame(maxWidth: .infinity).padding(.vertical, 16)
                            .foregroundStyle(palette.accentContrast).background(palette.accent, in: Capsule())
                    }.padding(.top, 28).padding(.bottom, 16)
                    ForEach([("Student", "Eligible university email"), ("Brand", "Business identity and Channel"), ("Creator", "Application and review")], id: \.0) { entry in
                        if let website = model.website {
                            Link(destination: website) {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(entry.0).font(CampusFont.bold(18)).foregroundStyle(palette.text)
                                    Text(entry.1).font(CampusFont.regular(12, relativeTo: .caption)).foregroundStyle(palette.secondary)
                                }.frame(maxWidth: .infinity, alignment: .leading).padding(20)
                                    .background(palette.surface, in: RoundedRectangle(cornerRadius: 28))
                            }.accessibilityHint("Opens account setup on the Campus Mint website").padding(.bottom, 12)
                        }
                    }
                }.padding(.horizontal, 20).padding(.top, 36).frame(maxWidth: 488)
                    .frame(maxWidth: .infinity)
            }.buttonStyle(CampusPressStyle())
        }
    }
}

struct SignInView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    let onBack: () -> Void
    @State private var email = ""
    @State private var code = ""
    @State private var codeSent = false
    @State private var working = false
    @State private var error: String?
    @FocusState private var field: Field?
    private enum Field { case email, code }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Button {
                    if codeSent { codeSent = false; code = ""; error = nil; field = .email }
                    else { onBack() }
                } label: { CampusLeaf(back: true).frame(width: 24, height: 24).frame(width: 44, height: 44).contentShape(Rectangle()) }
                .accessibilityLabel("Back").disabled(working).padding(.bottom, 28)
                Text("THE CAMPUS MINT").font(CampusFont.black(10, relativeTo: .caption2)).tracking(1.8).foregroundStyle(palette.accent)
                Text(codeSent ? "Check your email" : "Welcome back")
                    .font(CampusFont.black(36, relativeTo: .largeTitle)).tracking(-1.62).padding(.top, 12)
                    .accessibilityAddTraits(.isHeader)
                Text(codeSent ? "Code sent to \(email)." : "Your account email")
                    .font(CampusFont.regular(14, relativeTo: .subheadline)).foregroundStyle(palette.secondary).padding(.top, 32).padding(.bottom, 16)
                if codeSent {
                    TextField("Verification code", text: $code).textContentType(.oneTimeCode).keyboardType(.numberPad)
                        .font(CampusFont.black(24, relativeTo: .title2)).tracking(5.76).multilineTextAlignment(.center)
                        .focused($field, equals: .code).padding(.horizontal, 16).padding(.vertical, 14)
                        .background(palette.surface, in: RoundedRectangle(cornerRadius: 16))
                        .onChange(of: code) { _, value in code = String(value.filter(\.isNumber).prefix(6)) }
                } else {
                    TextField("you@example.com", text: $email).accessibilityLabel("Your account email")
                        .textContentType(.emailAddress).keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never).autocorrectionDisabled().submitLabel(.go)
                        .focused($field, equals: .email).padding(.horizontal, 16).padding(.vertical, 16)
                        .background(palette.surface, in: RoundedRectangle(cornerRadius: 16)).onSubmit { submit() }
                }
                Button { submit() } label: {
                    Text(working ? (codeSent ? "Signing in…" : "Sending…") : (codeSent ? "Sign in" : "Email me a sign-in code"))
                        .font(CampusFont.black(16)).frame(maxWidth: .infinity).padding(.vertical, 16)
                        .foregroundStyle(palette.accentContrast).background(palette.accent, in: Capsule())
                }.disabled(working || (codeSent ? code.count != 6 : !email.contains("@"))).opacity(working ? 0.5 : 1).padding(.top, 16)
                if let error { Text(error).font(CampusFont.bold(14)).foregroundStyle(palette.urgent).padding(.top, 16).accessibilityLabel("Error: \(error)") }
                if working { ProgressView().padding(.top, 16).accessibilityLabel("Signing in") }
            }.disabled(working).padding(.horizontal, 20).padding(.top, 24).padding(.bottom, 32)
                .frame(maxWidth: 488).frame(maxWidth: .infinity)
        }.scrollDismissesKeyboard(.interactively).buttonStyle(CampusPressStyle())
    }
    private func submit() {
        guard !working, codeSent ? code.count == 6 : email.contains("@") else { return }
        Task {
            working = true; error = nil
            defer { working = false }
            do {
                if codeSent { try await model.signIn(email: email, code: code) }
                else { try await model.requestCode(email); codeSent = true; field = .code }
            } catch { self.error = error.localizedDescription }
        }
    }
}

struct FeedView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                if model.posts.isEmpty { Text("No posts yet").font(CampusFont.regular(14)).foregroundStyle(palette.secondary).frame(maxWidth: .infinity).padding(.top, 80) }
                ForEach(model.posts) { post in MintPostView(post: post, author: model.authors[post.authorId]) }
                if !model.posts.isEmpty { Text("You're all caught up").font(CampusFont.bold(14)).frame(maxWidth: .infinity).padding(.vertical, 64) }
            }.padding(.horizontal, 10).padding(.top, 4)
        }.refreshable { await model.refreshFeed() }.scrollDismissesKeyboard(.interactively)
    }
}

struct MintPostView: View {
    @Environment(\.campusPalette) private var palette
    @State private var showingComments = false
    let post: MintPost
    let author: CampusUser?
    private var time: String {
        guard let date = campusDate(post.createdAt) else { return "" }
        let days = Int(Date().timeIntervalSince(date) / 86400)
        if days > 0 { return "\(days)d" }
        let hours = max(0, Int(Date().timeIntervalSince(date) / 3600))
        return hours > 0 ? "\(hours)h" : "Now"
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                CampusAvatar(name: author?.profile.displayName ?? "Campus member")
                VStack(alignment: .leading, spacing: 4) {
                    Text(author.map { "@" + $0.profile.username } ?? "Campus member").font(CampusFont.black(14))
                    Text([campusIdentities[author?.account.universityId ?? ""]?.name, time].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(CampusFont.regular(12, relativeTo: .caption)).foregroundStyle(palette.secondary)
                }
                Spacer(minLength: 0)
            }.padding(12)
            if !post.caption.isEmpty { Text(post.caption).font(CampusFont.regular(14)).lineSpacing(5).textSelection(.enabled).padding(.horizontal, 12).padding(.vertical, 8) }
            ForEach(post.media) { media in
                if let url = media.secureURL {
                    if media.type == "image" {
                        AsyncImage(url: url) { image in image.resizable().scaledToFit() }
                        placeholder: { ProgressView().frame(maxWidth: .infinity).padding(40) }
                        .accessibilityLabel("Post image")
                    } else if media.type == "video" { SecureVideoView(url: url) }
                }
            }
            if let poll = post.poll, let id = UUID(uuidString: post.id) { CampusPollView(postID: id, poll: poll).padding(12) }
            HStack(spacing: 16) {
                if let views = post.viewCount { Text("\(views) views") }
                if let comments = post.commentCount { Text("\(comments) comments") }
            }.font(CampusFont.regular(11, relativeTo: .caption2)).foregroundStyle(palette.secondary).padding(.horizontal, 12).padding(.top, 32)
            HStack(spacing: 4) {
                Button { showingComments = true } label: {
                    HStack(spacing: 6) { Image(systemName: "bubble"); if let count = post.commentCount { Text("\(count)").font(CampusFont.bold(12)) } }.frame(minWidth: 44, minHeight: 44)
                }.accessibilityLabel("Open comments")
                if let url = campusWebURL("https://www.thecampusmint.com/mint/\(post.id)") {
                    ShareLink(item: url) { Label("Share", systemImage: "square.and.arrow.up").font(CampusFont.bold(12)).frame(minHeight: 44) }.accessibilityLabel("Share Mint")
                }
                Spacer()
            }.foregroundStyle(palette.accent).padding(.horizontal, 12).padding(.bottom, 12)
        }.background(palette.surface, in: RoundedRectangle(cornerRadius: 24))
            .sheet(isPresented: $showingComments) { if let id = UUID(uuidString: post.id) { CommentsView(postID: id).presentationBackground(palette.background).presentationCornerRadius(32) } }
    }
}

struct ProfileView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    var body: some View {
        VStack(spacing: 0) {
            CampusPanelHeader(title: "Profile")
            ScrollView {
                if let user = model.account {
                    VStack(alignment: .leading, spacing: 20) {
                        VStack(alignment: .leading, spacing: 20) {
                            HStack(spacing: 16) {
                                CampusAvatar(name: user.profile.displayName, size: 96)
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(user.profile.displayName).font(CampusFont.black(24, relativeTo: .title2))
                                    if user.account.verifiedStudent { Label("Verified", systemImage: "checkmark.seal.fill").font(CampusFont.bold(10, relativeTo: .caption2)).foregroundStyle(palette.accent) }
                                    Text("@\(user.profile.username)").font(CampusFont.regular(14)).foregroundStyle(palette.secondary)
                                }
                            }
                            if let bio = user.profile.bio, !bio.isEmpty { Text(bio).font(CampusFont.regular(14)) }
                            if let major = user.profile.major, !major.isEmpty { Text(major).font(CampusFont.regular(12)).foregroundStyle(palette.secondary) }
                            HStack {
                                if let website = model.website { Link("Edit profile on website", destination: website).font(CampusFont.bold(12)).padding(.horizontal, 14).frame(minHeight: 44).foregroundStyle(palette.accent).background(palette.accentSoft, in: Capsule()) }
                                Spacer()
                                Button("Log out") { Task { await model.signOut() } }.font(CampusFont.bold(12)).foregroundStyle(palette.urgent).frame(minHeight: 44)
                            }
                        }.padding(20).frame(maxWidth: .infinity, alignment: .leading).background(palette.surface, in: RoundedRectangle(cornerRadius: 28))
                        Text("Mintz").font(CampusFont.bold(14)).foregroundStyle(palette.accent).padding(.horizontal, 16)
                        LazyVStack(spacing: 0) {
                            ForEach(model.posts.filter { $0.authorId == user.id }) { post in MintPostView(post: post, author: user) }
                        }
                    }.padding(16)
                }
            }
        }.background(palette.background).buttonStyle(CampusPressStyle())
    }
}
