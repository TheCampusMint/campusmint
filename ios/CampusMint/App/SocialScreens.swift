import SwiftUI
import CampusMintCore

/// Rows are memory-only and views are recreated for each canonical account UUID.
@MainActor
final class SocialPageModel<Row: SocialRow>: ObservableObject {
    @Published var rows: [Row] = []
    @Published var error: String?
    @Published var loading = false
    @Published var hasMore = false
    private var generation = UUID()

    func load(api: CampusAPI?, resource: String, target: UUID? = nil, older: Bool = false) async {
        guard let api, !loading else { return }
        let token = UUID(); generation = token; loading = true
        defer { if generation == token { loading = false } }
        do {
            let cursor = older ? rows.last.map { SocialCursor(date: $0.pageDate, id: $0.id) } : nil
            let page: SocialPage<Row> = try await api.socialPage(resource, target: target, before: cursor)
            guard !Task.isCancelled, generation == token else { return }
            if older {
                let previousIDs = Set(rows.map(\.id)); rows += page.items.filter { !previousIDs.contains($0.id) }
            } else { rows = page.items }
            hasMore = page.hasMore; error = nil
        } catch {
            guard !Task.isCancelled, generation == token else { return }
            // Never retain a private thread after a failed authorization check.
            rows = []; self.error = error.localizedDescription
        }
    }
}

struct MessagesView: View {
    @EnvironmentObject private var model: AppModel
    @StateObject private var inbox = SocialPageModel<SocialConversation>()
    var body: some View {
        NavigationStack {
            List {
                if let error = inbox.error { Text(error).foregroundStyle(.red) }
                if inbox.loading { ProgressView() }
                if !inbox.loading && inbox.rows.isEmpty && inbox.error == nil { Text("No messages yet").foregroundStyle(.secondary) }
                ForEach(inbox.rows) { conversation in
                    if let user = model.account {
                        NavigationLink {
                            MessageThreadView(peer: conversation.peer(for: user.id), name: conversation.display_name)
                        } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(conversation.display_name).font(.headline)
                                    if conversation.pinned { Image(systemName: "pin.fill").accessibilityLabel("Pinned") }
                                    Spacer()
                                    if conversation.unread > 0 { Text("\(conversation.unread)").foregroundStyle(model.accent).accessibilityLabel("\(conversation.unread) unread") }
                                }
                                if let last = conversation.last_message { Text(last.body).lineLimit(1).foregroundStyle(.secondary) }
                            }
                        }.swipeActions {
                            Button(conversation.pinned ? "Unpin" : "Pin") {
                                Task {
                                    do { try await model.mutateSocial(.init(action: "conversation_pin", target: conversation.peer(for: user.id), enabled: !conversation.pinned)); await refresh() }
                                    catch { inbox.error = error.localizedDescription }
                                }
                            }
                        }
                    }
                }
                if inbox.hasMore { Button("Older conversations") { Task { await inbox.load(api:model.api,resource:"conversations",older:true) } }.disabled(inbox.loading) }
            }.listStyle(.plain).navigationTitle("Messages")
                .task { await refresh() }.refreshable { await refresh() }
        }
    }
    private func refresh() async { await inbox.load(api: model.api, resource: "conversations") }
}

struct MessageThreadView: View {
    @EnvironmentObject private var model: AppModel
    let peer: UUID
    let name: String
    @StateObject private var thread = SocialPageModel<SocialMessage>()
    @State private var text = ""
    @State private var requestID = UUID()
    @State private var reply: SocialMessage?
    @State private var sending = false
    @State private var error: String?
    var body: some View {
        VStack(spacing: 12) {
            if let failure = error ?? thread.error { Text(failure).foregroundStyle(.red).padding(.horizontal) }
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 16) {
                    if thread.loading { ProgressView() }
                    if thread.hasMore { Button("Older messages") { Task { await thread.load(api:model.api,resource:"messages",target:peer,older:true) } }.disabled(thread.loading) }
                    ForEach(thread.rows.reversed()) { message in
                        let own = message.sender_id == model.account?.id
                        VStack(alignment: own ? .trailing : .leading, spacing: 5) {
                            if let parentID = message.reply_to_message_id,
                               let parent = thread.rows.first(where: { $0.id == parentID }) {
                                Text(parent.body).font(.caption).lineLimit(2).foregroundStyle(.secondary)
                            }
                            Text(message.body).textSelection(.enabled).padding(12)
                                .background(own ? model.accent.opacity(0.18) : Color.secondary.opacity(0.10), in: RoundedRectangle(cornerRadius: 20))
                            if own { Text(message.status).font(.caption2).foregroundStyle(.secondary) }
                            Button("Reply") { reply = message }.font(.caption)
                        }.frame(maxWidth: .infinity, alignment: own ? .trailing : .leading)
                    }
                }.padding()
            }.refreshable { await refresh() }
            if let reply {
                HStack { Text(reply.body).lineLimit(1).font(.caption); Spacer(); Button("Cancel reply") { self.reply = nil } }.padding(.horizontal)
            }
            HStack(alignment: .bottom) {
                TextField("Message", text: $text, axis: .vertical).lineLimit(1...5).padding(12)
                    .background(.quaternary, in: RoundedRectangle(cornerRadius: 18)).disabled(sending)
                    .onChange(of: text) { _, _ in requestID = UUID() }
                Button { Task { await send() } } label: { Image(systemName: "arrow.up").font(.title2) }
                    .accessibilityLabel("Send message").disabled(sending || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                if sending { ProgressView() }
            }.padding()
        }.navigationTitle(name).navigationBarTitleDisplayMode(.inline).task { await refresh() }
            .onChange(of: reply?.id) { _, _ in requestID = UUID() }
    }
    private func refresh() async {
        await thread.load(api: model.api, resource: "messages", target: peer)
        guard thread.error == nil, thread.rows.contains(where: { $0.sender_id == peer && $0.seen_at == nil }) else { return }
        do { try await model.mutateSocial(.init(action: "message_seen", target: peer)) }
        catch { self.error = error.localizedDescription }
    }
    private func send() async {
        guard !sending else { return }; sending = true; error = nil
        defer { sending = false }
        do {
            try await model.mutateSocial(.init(action: "message", target: peer, body: text.trimmingCharacters(in: .whitespacesAndNewlines), requestID: requestID, replyTo: reply?.id))
            text = ""; reply = nil; requestID = UUID(); await refresh()
        } catch { self.error = error.localizedDescription }
    }
}

struct CommentsView: View {
    @EnvironmentObject private var model: AppModel
    let postID: UUID
    @StateObject private var comments = SocialPageModel<SocialComment>()
    @State private var text = ""
    @State private var reply: SocialComment?
    @State private var requestID = UUID()
    @State private var sending = false
    @State private var error: String?
    var body: some View {
        NavigationStack {
            VStack {
                if let failure = error ?? comments.error { Text(failure).foregroundStyle(.red).padding() }
                List(comments.rows) { comment in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(comment.display_name).font(.headline)
                        if comment.parent_comment_id != nil { Label("Reply", systemImage: "arrow.turn.down.right").font(.caption).foregroundStyle(.secondary) }
                        Text(comment.body).textSelection(.enabled)
                        HStack {
                            Button { reply = comment } label: { Text("Reply") }
                            Button {
                                Task {
                                    do { try await model.mutateSocial(.init(action: "comment_like", target: comment.id, enabled: !comment.liked)); await refresh() }
                                    catch { self.error = error.localizedDescription }
                                }
                            } label: { Label("\(comment.like_count)", systemImage: comment.liked ? "heart.fill" : "heart") }
                            .accessibilityLabel(comment.liked ? "Unlike comment" : "Like comment")
                        }.font(.caption).buttonStyle(.plain)
                    }.swipeActions {
                        if comment.author_id == model.account?.id {
                            Button("Delete", role: .destructive) {
                                Task {
                                    do { try await model.mutateSocial(.init(action: "delete_comment", target: comment.id)); await refresh() }
                                    catch { self.error = error.localizedDescription }
                                }
                            }
                        }
                    }
                }.listStyle(.plain).refreshable { await refresh() }
                if comments.hasMore { Button("Older comments") { Task { await comments.load(api:model.api,resource:"comments",target:postID,older:true) } }.disabled(comments.loading) }
                if let reply { HStack { Text("Replying to \(reply.display_name)"); Spacer(); Button("Cancel") { self.reply = nil } }.font(.caption).padding(.horizontal) }
                HStack {
                    TextField("Comment", text: $text, axis: .vertical).lineLimit(1...4).disabled(sending)
                        .onChange(of: text) { _, _ in requestID = UUID() }
                    Button { Task { await send() } } label: { Image(systemName: "arrow.up") }
                        .accessibilityLabel("Post comment").disabled(sending || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }.padding()
            }.navigationTitle("Comments").navigationBarTitleDisplayMode(.inline)
                .task { await refresh() }.onChange(of: reply?.id) { _, _ in requestID = UUID() }
        }
    }
    private func refresh() async { await comments.load(api: model.api, resource: "comments", target: postID) }
    private func send() async {
        guard !sending else { return }; sending = true; error = nil; defer { sending = false }
        do {
            try await model.mutateSocial(.init(action: "comment", target: postID, body: text.trimmingCharacters(in: .whitespacesAndNewlines), requestID: requestID, parentID: reply?.id))
            text = ""; reply = nil; requestID = UUID(); await refresh()
        } catch { self.error = error.localizedDescription }
    }
}

struct NotificationsView: View {
    @EnvironmentObject private var model: AppModel
    @StateObject private var page = SocialPageModel<SocialNotification>()
    var body: some View {
        NavigationStack {
            List {
                if let error = page.error { Text(error).foregroundStyle(.red) }
                if page.loading { ProgressView() }
                if !page.loading && page.rows.isEmpty && page.error == nil { Text("No notifications").foregroundStyle(.secondary) }
                ForEach(page.rows) { notification in
                    HStack {
                        if notification.kind == "private_message", let peer = notification.actor_id {
                            NavigationLink(notification.title) { MessageThreadView(peer: peer, name: notification.display_name ?? "Message") }
                        } else { Text(notification.title) }
                        if notification.read_at == nil { Circle().fill(model.accent).frame(width: 7,height: 7).accessibilityLabel("Unread") }
                    }.swipeActions {
                        Button("Read") { Task { await markRead(notification.id) } }
                    }
                }
                if page.hasMore { Button("Older notifications") { Task { await page.load(api:model.api,resource:"notifications",older:true) } }.disabled(page.loading) }
            }.listStyle(.plain).navigationTitle("Notifications")
                .toolbar { Button("Read all") { Task { await markRead(nil) } }.disabled(page.rows.isEmpty) }
                .task { await refresh() }.refreshable { await refresh() }
        }
    }
    private func refresh() async { await page.load(api: model.api, resource: "notifications") }
    private func markRead(_ id: UUID?) async {
        do { try await model.mutateSocial(.init(action: "notification_read", target: id)); await refresh() }
        catch { page.error = error.localizedDescription }
    }
}
