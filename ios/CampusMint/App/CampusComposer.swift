import SwiftUI
import PhotosUI
import ImageIO
import CampusMintCore

struct TextComposer: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    let onClose: () -> Void
    @Binding var posting: Bool
    var maximumHeight: CGFloat = 520
    @State private var draft = ComposerDraft()
    @State private var owner: UUID?
    @State private var drafts: [ComposerDraft] = []
    @State private var showingDrafts = false
    @State private var expandedPrivacy = false
    @State private var privacyChosen = false
    @State private var expandedDuration = false
    @State private var error: String?
    @State private var selectedPhotos: [PhotosPickerItem] = []
    @State private var importing = false
    @State private var published = false
    @State private var leafSent = false
    @FocusState private var focused: Bool
    private var locked: Bool { posting || importing }
    private var valid: Bool { (try? TextPostRequest(caption: draft.caption, poll: draft.poll, media: draft.media)) != nil }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Button("Drafts\(drafts.isEmpty ? "" : " · \(drafts.count)")") { Task { await openDrafts() } }
                        .font(CampusFont.bold(12)).foregroundStyle(palette.accent).frame(minHeight: 44)
                    Spacer()
                    CampusIconButton(icon: "xmark", label: "Close composer") { Task { await saveAndClose() } }
                }.disabled(locked)
                if showingDrafts { draftList } else { editor }
                if let error { Text(error).font(CampusFont.regular(13)).foregroundStyle(palette.urgent).accessibilityLabel(error) }
            }.padding(20)
        }.scrollBounceBehavior(.basedOnSize).frame(maxHeight: maximumHeight).fixedSize(horizontal: false, vertical: true)
            .background(palette.surface, in: RoundedRectangle(cornerRadius: 32))
            .animation(reduceMotion ? nil : .spring(response: 0.34, dampingFraction: 0.86), value: draft.hasContent)
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: privacyChosen)
            .buttonStyle(CampusPressStyle())
            .task { owner = model.account?.id; await refreshDrafts() }
            .task(id: draft) {
                do { try await Task.sleep(for: .milliseconds(300)); try Task.checkCancellation(); if !locked { await save() } } catch { }
            }
            .onChange(of: draft) { old, new in
                if old.id == new.id && (old.caption != new.caption || old.privacy != new.privacy || old.durationHours != new.durationHours || old.poll != new.poll || old.media != new.media) {
                    draft.requestID = UUID(); draft.expiresAt = nil; draft.updatedAt = Date()
                }
            }
            .onChange(of: scenePhase) { _, phase in if phase != .active && !locked { Task { await save() } } }
            .onDisappear { if !published { let snapshot = draft; let account = owner; Task { await save(snapshot, owner: account) } } }
            .onChange(of: selectedPhotos) { _, items in if !items.isEmpty { Task { await importMedia(items) } } }
    }
    private var editor: some View {
        VStack(alignment: .leading, spacing: 12) {
            ZStack(alignment: .topLeading) {
                if draft.caption.isEmpty { Text("Text here").font(CampusFont.regular(16)).foregroundStyle(palette.secondary).padding(.top, 8).padding(.leading, 5) }
                TextEditor(text: $draft.caption).font(CampusFont.regular(16)).scrollContentBackground(.hidden).focused($focused)
                    .frame(height: 110).accessibilityLabel("Post text").disabled(locked)
            }
            HStack(spacing: 0) {
                Button { draft.caption += "#"; focused = true } label: { Text("#").font(CampusFont.bold(18)).frame(width: 44, height: 44) }.accessibilityLabel("Add hashtag")
                Button { draft.caption += "@"; focused = true } label: { Text("@").font(CampusFont.bold(18)).frame(width: 44, height: 44) }.accessibilityLabel("Type a mention")
                Spacer()
                PhotosPicker(selection: $selectedPhotos, maxSelectionCount: max(1, 6 - draft.media.count), matching: .any(of: [.images, .videos]), preferredItemEncoding: .automatic) {
                    Image(systemName: "photo.on.rectangle").frame(width: 44, height: 44)
                }.accessibilityLabel("Add photos or videos").disabled(draft.media.count >= 6)
                Menu {
                    Button(draft.poll == nil ? "Poll" : "Remove poll", systemImage: "chart.bar.xaxis") { draft.poll = draft.poll == nil ? PollInput() : nil }
                } label: { Image(systemName: "chevron.down").frame(width: 44, height: 44) }.accessibilityLabel("Post options")
            }.foregroundStyle(palette.accent).disabled(locked)
            if importing { ProgressView("Preparing media").font(CampusFont.regular(12)) }
            if !draft.media.isEmpty { attachments }
            if draft.poll != nil { pollEditor }
            if draft.hasContent { options.transition(.move(edge: .top).combined(with: .opacity)) }
            HStack {
                if draft.hasContent { Button("Save draft") { Task { await saveAndClose() } }.font(CampusFont.bold(12)).foregroundStyle(palette.secondary).disabled(locked) }
                Spacer()
                if posting && !published { ProgressView().accessibilityLabel("Publishing") }
                Button { Task { await publish() } } label: {
                    CampusLeaf().frame(width: 26, height: 26).frame(width: 44, height: 44)
                        .offset(x: leafSent && !reduceMotion ? 16 : 0, y: leafSent && !reduceMotion ? -32 : 0)
                        .rotationEffect(.degrees(leafSent && !reduceMotion ? -18 : 0))
                        .opacity(leafSent ? 0 : 1)
                }.foregroundStyle(palette.accent).accessibilityLabel("Publish post").disabled(locked || !valid).opacity(valid ? 1 : 0.35)
            }
        }
    }
    private var pollEditor: some View {
        VStack(alignment: .leading, spacing: 8) {
            TextField("Question", text: Binding(get: { draft.poll?.question ?? "" }, set: { draft.poll?.question = $0 }))
                .font(CampusFont.bold(15)).frame(minHeight: 44).accessibilityLabel("Poll question")
            ForEach(0..<(draft.poll?.options.count ?? 0), id: \.self) { index in
                HStack {
                    TextField("Option \(index + 1)", text: Binding(get: { draft.poll?.options.indices.contains(index) == true ? draft.poll!.options[index] : "" }, set: { if draft.poll?.options.indices.contains(index) == true { draft.poll?.options[index] = $0 } }))
                        .font(CampusFont.regular(14)).frame(minHeight: 44)
                    if (draft.poll?.options.count ?? 0) > 2 { CampusIconButton(icon: "minus", label: "Remove option \(index + 1)") { draft.poll?.options.remove(at: index) } }
                }
            }
            if (draft.poll?.options.count ?? 0) < 6 { Button("Add option") { draft.poll?.options.append("") }.font(CampusFont.bold(12)).foregroundStyle(palette.accent).frame(minHeight: 44) }
        }.textFieldStyle(.plain).disabled(locked)
    }
    private var attachments: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 10) {
                ForEach(draft.media) { media in
                    VStack(spacing: 0) {
                        DraftMediaPreview(media: media, draft: draft.id, owner: owner)
                        Button { draft.media.removeAll { $0.id == media.id } } label: { Image(systemName: "xmark").frame(width: 44, height: 44) }
                            .accessibilityLabel("Remove \(media.isVideo ? "video" : "photo")").disabled(locked)
                    }
                }
            }
        }
    }
    private var options: some View {
        VStack(spacing: 8) {
            optionRow("Privacy · \(draft.privacy.label)", expanded: expandedPrivacy) { expandedPrivacy.toggle() }
            if expandedPrivacy {
                ForEach(PostPrivacy.allCases, id: \.self) { value in
                    Button { draft.privacy = value; privacyChosen = true; expandedPrivacy = false } label: {
                        HStack { Text(value.label); Spacer(); if draft.privacy == value { Image(systemName: "checkmark") } }.font(CampusFont.bold(13)).frame(minHeight: 44)
                    }.foregroundStyle(draft.privacy == value ? palette.accent : palette.text)
                }
            }
            if privacyChosen {
                optionRow("Duration · \(draft.durationHours == 0 ? "Permanent" : "24 hours")", expanded: expandedDuration) { expandedDuration.toggle() }
                if expandedDuration {
                    ForEach([0, 24], id: \.self) { hours in
                        Button { draft.durationHours = hours; expandedDuration = false } label: {
                            HStack { Text(hours == 0 ? "Permanent" : "24 hours"); Spacer(); if draft.durationHours == hours { Image(systemName: "checkmark") } }.font(CampusFont.bold(13)).frame(minHeight: 44)
                        }.foregroundStyle(palette.accent)
                    }
                }
            }
        }.disabled(locked)
    }
    private var draftList: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack { Text("Drafts").font(CampusFont.black(20)); Spacer(); Button("New") { draft = ComposerDraft(); showingDrafts = false; privacyChosen = false }.font(CampusFont.bold(13)).foregroundStyle(palette.accent).frame(minHeight: 44) }
            if drafts.isEmpty { Text("No drafts").foregroundStyle(palette.secondary).frame(maxWidth: .infinity, minHeight: 80) }
            ForEach(drafts) { item in
                HStack {
                    Button { draft = item; showingDrafts = false; privacyChosen = item.privacy != .public || item.durationHours != 0 } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.label).font(CampusFont.bold(14)).lineLimit(2)
                            Text(item.updatedAt, style: .date).font(CampusFont.regular(11)).foregroundStyle(palette.secondary)
                        }.frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
                    }
                    CampusIconButton(icon: "trash", label: "Delete draft") { Task { await delete(item) } }
                }
            }
        }
    }
    private func optionRow(_ label: String, expanded: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) { HStack { Text(label).font(CampusFont.bold(12)); Spacer(); Image(systemName: expanded ? "chevron.up" : "chevron.down").font(.system(size: 11)) }.padding(.horizontal, 14).frame(minHeight: 44).background(palette.raised, in: Capsule()) }.foregroundStyle(palette.text)
    }
    private func refreshDrafts() async {
        guard let owner, model.account?.id == owner else { return }
        do { drafts = try await model.drafts.list(owner: owner) } catch { self.error = "Couldn’t open drafts. Try again." }
    }
    private func save(_ snapshot: ComposerDraft? = nil, owner account: UUID? = nil) async {
        guard !published, let owner = account ?? owner else { return }
        do { try await model.drafts.save(snapshot ?? draft, owner: owner) }
        catch { self.error = "Couldn’t save your draft. Keep this composer open and try again."; model.message = self.error }
    }
    private func saveAndClose() async {
        guard !locked, let owner else { return }
        do { try await model.drafts.save(draft, owner: owner); onClose() }
        catch { self.error = "Couldn’t save your draft. Try again." }
    }
    private func openDrafts() async {
        guard !locked else { return }; focused = false
        await save(); await refreshDrafts(); showingDrafts.toggle()
    }
    private func delete(_ item: ComposerDraft) async {
        guard let owner else { return }
        do { try await model.drafts.delete(item.id, owner: owner); if draft.id == item.id { draft = ComposerDraft() }; await refreshDrafts() }
        catch { self.error = "Couldn’t delete this draft." }
    }
    private func importMedia(_ items: [PhotosPickerItem]) async {
        guard let owner, !locked, model.account?.id == owner else { return }
        importing = true; posting = true; error = nil
        defer { importing = false; posting = false; selectedPhotos = [] }
        do {
            let directory = try await model.drafts.directory(owner: owner, draft: draft.id)
            for item in items.prefix(6 - draft.media.count) {
                guard let imported = try await item.loadTransferable(type: PickedCampusMedia.self) else { throw CampusError.invalidPost("Couldn’t open this item.") }
                let media = try await CampusMediaPreparation.prepare(imported.url, video: item.supportedContentTypes.contains(where: { $0.conforms(to: .movie) }), highQuality: model.highQualityUploads, directory: directory)
                guard model.account?.id == owner else { throw CampusError.signedOut }
                try UploadMedia.validate(draft.media + [media]); draft.media.append(media)
                try await model.drafts.save(draft, owner: owner)
            }
        } catch { self.error = error.localizedDescription }
    }
    private func publish() async {
        guard valid, !locked, let owner else { return }
        focused = false; posting = true; error = nil
        defer { posting = false }
        do {
            if draft.durationHours == 24 && draft.expiresAt == nil { draft.expiresAt = ISO8601DateFormatter().string(from: Date().addingTimeInterval(86400)) }
            try await model.drafts.save(draft, owner: owner)
            try await model.publish(draft: draft, owner: owner)
            published = true
            do { try await model.drafts.delete(draft.id, owner: owner) } catch { model.message = "Published. The local draft could not be removed." }
            withAnimation(reduceMotion ? .easeOut(duration: 0.15) : .easeOut(duration: 0.4)) { leafSent = true }
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            try? await Task.sleep(for: .milliseconds(reduceMotion ? 150 : 450))
            onClose()
        } catch { self.error = error.localizedDescription }
    }
}

private struct DraftMediaPreview: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    let media: UploadMedia
    let draft: UUID
    let owner: UUID?
    @State private var image: UIImage?
    var body: some View {
        Group {
            if let image { Image(uiImage: image).resizable().scaledToFit() }
            else { Image(systemName: media.isVideo ? "video" : "photo").foregroundStyle(palette.accent) }
        }.frame(width: 108, height: 100).background(palette.raised, in: RoundedRectangle(cornerRadius: 16))
            .accessibilityLabel(media.isVideo ? "Attached video" : "Attached photo")
            .task {
                guard !media.isVideo, let owner, let url = try? await model.drafts.mediaURL(owner: owner, draft: draft, media: media) else { return }
                if let source = CGImageSourceCreateWithURL(url as CFURL, nil),
                   let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true, kCGImageSourceThumbnailMaxPixelSize: 240] as CFDictionary) {
                    image = UIImage(cgImage: thumbnail)
                }
            }
    }
}

struct CampusPollView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    let postID: UUID
    let poll: MintPoll
    @State private var updated: MintPoll?
    @State private var voting = false
    @State private var error: String?
    private var current: MintPoll { updated ?? poll }
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(current.question).font(CampusFont.bold(16))
            ForEach(current.options) { option in
                Button { Task { await vote(option.id) } } label: {
                    HStack {
                        Text(option.label); Spacer()
                        if current.selectedOptionId == option.id { Image(systemName: "checkmark") }
                        Text("\(option.voteCount)").foregroundStyle(palette.secondary)
                    }.font(CampusFont.regular(14)).padding(12).frame(minHeight: 44)
                        .background(palette.accentSoft, in: RoundedRectangle(cornerRadius: 14))
                }.foregroundStyle(current.selectedOptionId == option.id ? palette.accent : palette.text)
                    .accessibilityAddTraits(current.selectedOptionId == option.id ? .isSelected : []).disabled(voting)
            }
            if voting { ProgressView() }
            if let error { Text(error).font(CampusFont.regular(12)).foregroundStyle(palette.urgent) }
        }.onChange(of: poll.totalVotes) { _, _ in updated = nil }
    }
    private func vote(_ option: String) async {
        guard !voting else { return }; voting = true; error = nil; defer { voting = false }
        do { updated = try await model.vote(post: postID, option: option) }
        catch { self.error = error.localizedDescription }
    }
}
