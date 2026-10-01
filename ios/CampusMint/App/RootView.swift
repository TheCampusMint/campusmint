import SwiftUI
import CampusMintCore

struct RootView: View {
    @EnvironmentObject private var model: AppModel
    var body: some View {
        Group {
            if model.isRestoring {
                ProgressView("Campus Mint")
            } else if model.account == nil {
                SignInView()
            } else {
                TabView {
                    FeedView().tabItem { Label("Mint", systemImage: "leaf") }
                    ProfileView().tabItem { Label("Profile", systemImage: "person") }
                }
            }
        }
        .alert("Campus Mint", isPresented: Binding(get: { model.message != nil }, set: { if !$0 { model.message = nil } })) {
            Button("OK") { model.message = nil }
        } message: { Text(model.message ?? "") }
    }
}

struct SignInView: View {
    @EnvironmentObject private var model: AppModel
    @State private var email = ""
    @State private var code = ""
    @State private var codeSent = false
    @State private var working = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 24) {
                Image(systemName: "leaf").font(.largeTitle).foregroundStyle(model.accent)
                Text("Welcome back").font(.largeTitle.bold())
                TextField("University email", text: $email)
                    .textContentType(.emailAddress).keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                    .padding().background(.quaternary, in: RoundedRectangle(cornerRadius: 18))
                    .disabled(codeSent || working)
                if codeSent {
                    TextField("Code", text: $code).textContentType(.oneTimeCode)
                        .keyboardType(.numberPad).padding()
                        .background(.quaternary, in: RoundedRectangle(cornerRadius: 18))
                        .onChange(of: code) { _, value in code = String(value.filter(\.isNumber).prefix(6)) }
                }
                if let error { Text(error).font(.callout).foregroundStyle(.red) }
                Button(codeSent ? "Sign in" : "Send code") {
                    Task {
                        working = true; error = nil
                        defer { working = false }
                        do {
                            if codeSent { try await model.signIn(email: email, code: code) }
                            else { try await model.requestCode(email); codeSent = true }
                        } catch { self.error = error.localizedDescription }
                    }
                }
                .buttonStyle(.borderedProminent).controlSize(.large)
                .disabled(working || (codeSent ? code.count != 6 : !email.contains("@")))
                if working { ProgressView() }
                if codeSent {
                    Button("Use another email") { codeSent = false; code = ""; error = nil }
                        .disabled(working)
                }
                if let website = model.website { Link("Create an account on the website", destination: website) }
                Spacer()
            }
            .padding(28).padding(.top, 36)
        }
    }
}

struct FeedView: View {
    @EnvironmentObject private var model: AppModel
    @State private var composing = false
    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 28) {
                    if model.posts.isEmpty { Text("No posts yet").foregroundStyle(.secondary).frame(maxWidth: .infinity).padding(.top, 80) }
                    ForEach(model.posts) { post in
                        MintPostView(post: post, author: model.authors[post.authorId])
                    }
                }.padding()
            }
            .navigationTitle("Mint")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { composing = true } label: { Image(systemName: "plus") }
                        .accessibilityLabel("Create post").disabled(!model.canPublish)
                }
            }
            .refreshable { await model.refreshFeed() }
            .sheet(isPresented: $composing) { TextComposer() }
        }
    }
}

struct MintPostView: View {
    let post: MintPost
    let author: CampusUser?
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(author?.profile.displayName ?? "Campus member").font(.headline)
                Spacer()
                if let url = URL(string: "https://www.thecampusmint.com/mint/\(post.id)") {
                    ShareLink(item: url) { Image(systemName: "square.and.arrow.up") }
                        .accessibilityLabel("Share post")
                }
            }
            if let author { Text("@\(author.profile.username)").font(.subheadline).foregroundStyle(.secondary) }
            if !post.caption.isEmpty { Text(post.caption).textSelection(.enabled) }
            ForEach(post.media) { media in
                if let url = media.secureURL {
                    if media.type == "image" {
                        AsyncImage(url: url) { image in image.resizable().scaledToFit() }
                        placeholder: { ProgressView().frame(maxWidth: .infinity).padding() }
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .accessibilityLabel("Post image")
                    } else if media.type == "video" {
                        SecureVideoView(url: url)
                    }
                }
            }
            if let poll = post.poll {
                Text(poll.question).font(.headline)
                ForEach(poll.options) { option in
                    HStack { Text(option.label); Spacer(); Text("\(option.voteCount)").foregroundStyle(.secondary) }
                }
                if let url = URL(string: "https://www.thecampusmint.com") { Link("Vote on the website", destination: url) }
            }
        }
        .padding(.vertical, 8)
    }
}

struct TextComposer: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var requestID = UUID()
    @State private var posting = false
    @State private var error: String?
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ZStack(alignment: .topLeading) {
                if text.isEmpty { Text("Text here").foregroundStyle(.secondary).padding(.top, 12).padding(.leading, 5) }
                TextEditor(text: $text).scrollContentBackground(.hidden).focused($focused)
                    .frame(minHeight: 100, maxHeight: 240).accessibilityLabel("Post text")
                    .disabled(posting)
                    .onChange(of: text) { _, _ in requestID = UUID() }
            }
            if let error { Text(error).foregroundStyle(.red).font(.callout) }
            HStack {
                Text("Public · Permanent").font(.caption).foregroundStyle(.secondary)
                Spacer()
                if posting { ProgressView() }
                Button {
                    Task {
                        posting = true; error = nil
                        defer { posting = false }
                        do { try await model.publish(text: text, requestID: requestID); dismiss() }
                        catch { self.error = error.localizedDescription }
                    }
                } label: { Image(systemName: "leaf.fill").font(.title2) }
                .accessibilityLabel("Publish post")
                .disabled(posting || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(24).presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible).presentationCornerRadius(28)
        .interactiveDismissDisabled(posting)
        .task { focused = true }
    }
}

struct ProfileView: View {
    @EnvironmentObject private var model: AppModel
    var body: some View {
        NavigationStack {
            List {
                if let user = model.account {
                    Section {
                        Text(user.profile.displayName).font(.title2.bold())
                        Text("@\(user.profile.username)")
                        if let bio = user.profile.bio, !bio.isEmpty { Text(bio) }
                        if let major = user.profile.major, !major.isEmpty { Text(major) }
                    }
                }
                Section("Appearance") {
                    Picker("Appearance", selection: $model.appearance) {
                        ForEach(Appearance.allCases) { Text($0.label).tag($0) }
                    }.pickerStyle(.segmented)
                }
                if let website = model.website {
                    Section {
                        Link("Open website", destination: website)
                    }
                }
                Section { Button("Sign out", role: .destructive) { Task { await model.signOut() } } }
            }
            .navigationTitle("Profile")
        }
    }
}
