import SwiftUI
import CoreLocation
import CampusMintCore

struct CampusEntry: View {
    @Environment(\.campusPalette) private var palette
    let label: String
    @Binding var text: String
    var multiline = false
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label).font(CampusFont.bold(12)).foregroundStyle(palette.secondary)
            TextField(label, text: $text, axis: multiline ? .vertical : .horizontal)
                .lineLimit(multiline ? 3...8 : 1...1).font(CampusFont.regular(16))
                .padding(14).background(palette.raised, in: RoundedRectangle(cornerRadius: 16))
                .accessibilityLabel(label)
        }
    }
}

struct NativeClubEditor: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    @Environment(\.dismiss) private var dismiss
    let club: CampusClub?
    let saved: (UUID?) async -> Void
    @State private var draft: ClubDraft
    @State private var tags: String
    @State private var busy = false
    @State private var error: String?
    init(club: CampusClub?, saved: @escaping (UUID?) async -> Void) {
        self.club = club; self.saved = saved
        _draft = State(initialValue: ClubDraft(club: club)); _tags = State(initialValue: club?.tags?.joined(separator: ", ") ?? "")
    }
    var body: some View {
        VStack(spacing: 0) {
            CampusPanelHeader(title: club == nil ? "Create club" : "Edit club")
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    CampusEntry(label: "Name", text: $draft.name)
                    if club == nil { CampusEntry(label: "Handle", text: $draft.handle).textInputAutocapitalization(.never).autocorrectionDisabled() }
                    CampusEntry(label: "Description", text: $draft.description, multiline: true)
                    if let club {
                        HStack { Text("Visibility"); Spacer(); Picker("Visibility", selection: $draft.visibility) { Text("Private").tag("private"); Text("Public").tag("public") }.disabled(club.role != "leader") }
                        CampusEntry(label: "Meetup location", text: $draft.location)
                        CampusEntry(label: "Meeting times", text: $draft.schedule)
                        CampusEntry(label: "Website", text: $draft.website).textInputAutocapitalization(.never).keyboardType(.URL)
                        CampusEntry(label: "Cover image link", text: $draft.photo).textInputAutocapitalization(.never).keyboardType(.URL)
                        CampusEntry(label: "Interests", text: $tags)
                    } else { Text("Private · Approval required").font(CampusFont.regular(12)).foregroundStyle(palette.secondary) }
                    if let error { Text(error).foregroundStyle(palette.urgent) }
                    HStack { Spacer(); if busy { ProgressView() }; Button(club == nil ? "Create" : "Save") { Task { await save() } }.font(CampusFont.bold(16)).frame(minHeight: 44) }
                }.padding(20).disabled(busy)
            }.scrollDismissesKeyboard(.interactively)
        }.background(palette.background).foregroundStyle(palette.text).buttonStyle(CampusPressStyle()).interactiveDismissDisabled(busy)
    }
    private func save() async {
        guard !busy, let owner = model.account?.id else { return }; busy = true; error = nil; defer { busy = false }
        do {
            draft.tags = tags.split(separator: ",").map(String.init)
            let result = try await model.writeCampus(.club, body: JSONEncoder().encode(draft.validated()), owner: owner)
            await saved(result.id); dismiss()
        } catch { self.error = error.localizedDescription }
    }
}

struct NativeClubDetail: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    let id: String
    let changed: () async -> Void
    @State private var club: CampusClub?
    @State private var error: String?
    @State private var busy = false
    @State private var loading = false
    @State private var editing = false
    @State private var inviting = false
    @State private var query = ""
    @State private var people: [ClubPerson] = []
    @State private var sent: Set<UUID> = []
    @State private var searchGeneration = UUID()
    @State private var pendingReload = false
    var body: some View {
        VStack(spacing: 0) {
            CampusPanelHeader(title: club?.name ?? "Club")
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if let error { CampusFailure(message: error) { Task { await load() } } }
                    if let club {
                        if let photo = campusWebURL(club.photo) { AsyncImage(url: photo) { $0.resizable().scaledToFit() } placeholder: { ProgressView() } }
                        HStack { Text("\(club.visibility.capitalized) · \(club.memberCount) members").font(CampusFont.regular(12)); Spacer()
                            if club.editable == true && club.canManage { Button("Edit") { editing = true } }
                        }
                        Text(club.description ?? club.summary).font(CampusFont.regular(16)).textSelection(.enabled)
                        if let location = club.location, !location.isEmpty { Label(location, systemImage: "mappin") }
                        if let schedule = club.schedule, !schedule.isEmpty { Text(schedule) }
                        if let link = campusWebURL(club.website) { Link("Website", destination: link) }
                        if club.editable == true {
                            membership(club)
                            if club.canManage {
                                Button("+ Invite people") { inviting.toggle(); if inviting { Task { await searchPeople() } } }
                                if inviting { invitations }
                                Text("Members & requests").font(CampusFont.bold(16))
                                ForEach(club.members ?? []) { person in member(person, club: club) }
                            }
                        }
                    } else if loading { ProgressView() }
                    else if error == nil { Text("Club unavailable") }
                }.padding(20).frame(maxWidth: .infinity, alignment: .leading)
            }.refreshable { await load() }
        }.background(palette.background).foregroundStyle(palette.text).buttonStyle(CampusPressStyle())
            .task { for await _ in model.socialChanges.updates() { if Task.isCancelled { break }; await load() } }
            .sheet(isPresented: $editing) { if let club { NativeClubEditor(club: club) { _ in await load(); await changed() }.presentationBackground(palette.background) } }
    }
    @ViewBuilder private func membership(_ club: CampusClub) -> some View {
        if club.invited && !["leader", "officer", "member"].contains(club.role ?? "") {
            HStack { action("Accept invitation", .accept_invite); action("Decline", .decline_invite) }
        } else if club.role == "requested" { action("Cancel request", .cancel) }
        else if club.role == nil { action("Request to join", .request) }
        else if club.role != "leader" { action("Leave club", .leave) }
    }
    private func action(_ label: String, _ action: ClubAction, target: UUID? = nil) -> some View {
        Button(label) { Task { await act(action, target: target) } }.disabled(busy).font(CampusFont.bold(13)).frame(minHeight: 44).foregroundStyle(palette.accent)
    }
    private func member(_ person: ClubPerson, club: CampusClub) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack { Text(person.name).font(CampusFont.bold(14)); Spacer(); Text(person.roleLabel).font(CampusFont.regular(12)).foregroundStyle(palette.secondary) }
            HStack {
                if person.role == "requested" { action("Accept", .approve, target: person.id); action("Decline", .reject, target: person.id) }
                else {
                    if club.role == "leader" && person.role != "leader" { action(person.role == "officer" ? "Remove admin" : "Make admin", person.role == "officer" ? .demote : .promote, target: person.id) }
                    if let owner = model.account?.id, club.canRemove(person, actor: owner) { action("Remove", .remove, target: person.id) }
                }
            }
        }
    }
    private var invitations: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack { TextField("Name or username", text: $query).textInputAutocapitalization(.never).onSubmit { Task { await searchPeople() } }; Button("Search") { Task { await searchPeople() } } }
            ForEach(people) { person in HStack { VStack(alignment: .leading) { Text(person.name); Text("@\(person.username)").font(CampusFont.regular(12)) }; Spacer(); Button(sent.contains(person.id) ? "Invited" : "Invite") { Task { await act(.invite, target: person.id) } }.disabled(busy || sent.contains(person.id)) } }
            if people.isEmpty { Text("No matches").font(CampusFont.regular(12)) }
        }.padding(16).background(palette.surface, in: RoundedRectangle(cornerRadius: 20))
            .onChange(of: query) { _, _ in searchGeneration = UUID(); people = [] }
    }
    private func load() async {
        guard let api = model.api else { return }
        if loading { pendingReload = true; return }
        loading = true; defer { loading = false }
        repeat {
            pendingReload = false
            do { let result: ClubsResponse = try await api.campusResource(.clubs, query: [.init(name: "id", value: id)]); try Task.checkCancellation(); club = result.clubs.first; error = nil }
            catch { if !Task.isCancelled { club = nil; self.error = error.localizedDescription } }
        } while pendingReload && !Task.isCancelled
    }
    private func act(_ action: ClubAction, target: UUID? = nil) async {
        guard !busy, let owner = model.account?.id, let id = UUID(uuidString: id) else { return }; busy = true; error = nil; defer { busy = false }
        do {
            let data = try JSONEncoder().encode(ClubChange(action, club: id, target: target))
            _ = try await model.writeCampus(.club, body: data, owner: owner)
            if action == .invite, let target { sent.insert(target) }
            await load(); await changed()
        } catch { self.error = error.localizedDescription }
    }
    private func searchPeople() async {
        guard let api = model.api else { return }; let generation = UUID(); searchGeneration = generation
        do {
            let result: ClubsResponse = try await api.campusResource(.clubs, query: [.init(name: "id", value: id), .init(name: "people", value: query)])
            guard generation == searchGeneration, !Task.isCancelled else { return }; people = result.people ?? []
        } catch { if generation == searchGeneration { self.error = error.localizedDescription } }
    }
}

struct NativeListingComposer: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    @Environment(\.dismiss) private var dismiss
    let coordinate: CampusCoordinate?
    let saved: () async -> Void
    @State private var draft = ListingDraft()
    @State private var price = ""
    @State private var busy = false
    @State private var error: String?
    private var signature: [String] { [draft.title, draft.brand, draft.pickupArea, price, draft.condition.rawValue, String(draft.shareNearbyArea)] }
    var body: some View {
        VStack(spacing: 0) {
            CampusPanelHeader(title: "Post item")
            ScrollView { VStack(spacing: 18) {
                CampusEntry(label: "Item name", text: $draft.title)
                CampusEntry(label: "Price", text: $price).keyboardType(.decimalPad)
                CampusEntry(label: "Brand", text: $draft.brand)
                HStack { Text("Condition"); Spacer(); Picker("Condition", selection: $draft.condition) { ForEach(ListingCondition.allCases, id: \.self) { Text($0.label).tag($0) } } }
                CampusEntry(label: "Meetup location", text: $draft.pickupArea)
                Toggle("Show nearby · approximate area", isOn: $draft.shareNearbyArea).disabled(coordinate == nil).tint(palette.accent)
                if let error { Text(error).foregroundStyle(palette.urgent) }
                HStack { Spacer(); if busy { ProgressView() }; Button("Post item") { Task { await publish() } }.font(CampusFont.bold(16)).frame(minHeight: 44) }
            }.padding(20).disabled(busy) }.scrollDismissesKeyboard(.interactively)
        }.background(palette.background).foregroundStyle(palette.text).buttonStyle(CampusPressStyle()).interactiveDismissDisabled(busy)
            .onChange(of: signature) { _, _ in draft.requestId = UUID() }
    }
    private func publish() async {
        guard !busy, let owner = model.account?.id else { return }; busy = true; error = nil; defer { busy = false }
        do {
            guard let amount = Double(price.replacingOccurrences(of: ",", with: ".")) else { throw CampusError.invalidPost("Enter a price.") }
            draft.askingPrice = amount; draft.nearbyLocation = coordinate
            _ = try await model.writeCampus(.listing, body: JSONEncoder().encode(draft.validated()), owner: owner)
            await saved(); dismiss()
        } catch { self.error = error.localizedDescription }
    }
}

struct NativeListingDetail: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    let listing: CampusListing
    let changed: () async -> Void
    @State private var messages: [MarketplaceMessage] = []
    @State private var buyers: [MarketplaceBuyer] = []
    @State private var buyer: UUID?
    @State private var text = ""
    @State private var error: String?
    @State private var busy = false
    @State private var loading = false
    @State private var request = UUID()
    @State private var status: String
    init(listing: CampusListing, changed: @escaping () async -> Void) { self.listing = listing; self.changed = changed; _status = State(initialValue: listing.status) }
    private var own: Bool { listing.sellerId.lowercased() == model.account?.id.uuidString.lowercased() }
    private var selectedBuyer: UUID? { own ? buyer : model.account?.id }
    private var thread: [MarketplaceMessage] { messages.filter { $0.buyer_id == selectedBuyer } }
    var body: some View {
        VStack(spacing: 0) {
            CampusPanelHeader(title: listing.title)
            ScrollView { VStack(alignment: .leading, spacing: 16) {
                Text(listing.askingPrice, format: .currency(code: "USD")).font(CampusFont.black(24))
                Text([listing.brand, ListingCondition(rawValue: listing.condition)?.label ?? listing.condition, listing.pickupArea].filter { !$0.isEmpty }.joined(separator: " · "))
                if own { Button(status == "sold" ? "Mark available" : "Mark sold") { Task { await updateStatus() } }.disabled(busy) }
                else if status == "sold" { Text("Sold").font(CampusFont.bold(14)) }
                if let error { CampusFailure(message: error) { Task { await load() } } }
                if own { Picker("Buyer", selection: $buyer) { Text("Choose buyer").tag(UUID?.none); ForEach(buyers) { Text($0.first_name).tag(Optional($0.id)) } }.accessibilityLabel("Buyer") }
                ForEach(thread) { message in
                    Text(message.body).textSelection(.enabled).padding(12)
                        .background(message.sender_id == model.account?.id ? palette.accentSoft : palette.raised, in: RoundedRectangle(cornerRadius: 18))
                        .frame(maxWidth: .infinity, alignment: message.sender_id == model.account?.id ? .trailing : .leading)
                }
                if thread.isEmpty { Text("No messages yet").font(CampusFont.regular(14)).foregroundStyle(palette.secondary) }
            }.padding(20) }.refreshable { await load() }
            if selectedBuyer != nil && (!own || !thread.isEmpty) && (status != "sold" || !thread.isEmpty) {
                HStack { TextField("Message", text: $text, axis: .vertical).lineLimit(1...5).padding(12).background(palette.raised, in: RoundedRectangle(cornerRadius: 16)); Button { Task { await send() } } label: { Image(systemName: "arrow.up").frame(width: 44, height: 44) }.accessibilityLabel("Send message").disabled(busy || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) }.padding(16).disabled(busy)
            }
        }.background(palette.background).foregroundStyle(palette.text).buttonStyle(CampusPressStyle())
            .task { for await _ in model.socialChanges.updates() { if Task.isCancelled { break }; await load() } }
            .onChange(of: text) { _, _ in request = UUID() }.onChange(of: buyer) { _, _ in request = UUID(); text = "" }
    }
    private func load() async {
        guard !loading, let api = model.api else { return }; loading = true; defer { loading = false }
        do {
            let result: MarketplaceMessages = try await api.campusResource(.marketplaceMessages, query: [.init(name: "listingId", value: listing.id)])
            try Task.checkCancellation(); messages = result.messages; buyers = result.buyers; if let latest = result.listingStatus { status = latest }; error = nil
            if own, buyer == nil { buyer = buyers.first?.id }
        } catch { if !Task.isCancelled { messages = []; buyers = []; self.error = error.localizedDescription } }
    }
    private func send() async {
        guard !busy, let owner = model.account?.id, let id = UUID(uuidString: listing.id) else { return }; busy = true; error = nil; defer { busy = false }
        do {
            let body = try JSONEncoder().encode(MarketplaceSend(listing: id, buyer: own ? buyer : nil, body: text, request: request))
            _ = try await model.writeCampus(.marketplaceMessage, body: body, owner: owner)
            text = ""; request = UUID(); await load()
        } catch { self.error = error.localizedDescription }
    }
    private func updateStatus() async {
        guard !busy, let owner = model.account?.id, let id = UUID(uuidString: listing.id) else { return }; busy = true; defer { busy = false }
        do { let sold = status != "sold"; _ = try await model.writeCampus(.listingStatus, body: JSONEncoder().encode(ListingStatus(id: id, sold: sold)), owner: owner); status = sold ? "sold" : "active"; await changed() }
        catch { self.error = error.localizedDescription }
    }
}

struct NativeProfileEditor: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    @Environment(\.dismiss) private var dismiss
    @State private var draft: ProfileDraft
    @State private var year: String
    @State private var busy = false
    @State private var error: String?
    let owner: UUID
    init(user: CampusUser) { owner = user.id; _draft = State(initialValue: ProfileDraft(user.profile)); _year = State(initialValue: user.profile.graduationYear.map(String.init) ?? "") }
    private func list(_ value: Binding<[String]>) -> Binding<String> { Binding(get: { value.wrappedValue.joined(separator: ", ") }, set: { value.wrappedValue = $0.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) } }) }
    var body: some View {
        VStack(spacing: 0) {
            CampusPanelHeader(title: "Edit profile")
            ScrollView { VStack(spacing: 18) {
                CampusEntry(label: "First name", text: $draft.firstName)
                CampusEntry(label: "Last name", text: $draft.lastName)
                CampusEntry(label: "Username", text: $draft.username).textInputAutocapitalization(.never).autocorrectionDisabled()
                CampusEntry(label: "Display name", text: $draft.displayName)
                CampusEntry(label: "Bio", text: $draft.bio, multiline: true)
                CampusEntry(label: "Major", text: $draft.major)
                CampusEntry(label: "Academic area", text: $draft.academicArea)
                CampusEntry(label: "Graduation year", text: $year).keyboardType(.numberPad)
                CampusEntry(label: "Interests", text: list($draft.interests))
                CampusEntry(label: "Hobbies", text: list($draft.hobbies))
                CampusEntry(label: "Hometown", text: $draft.hometown)
                DisclosureGroup("Roommate & tutoring") {
                    VStack(spacing: 16) {
                        Toggle("Looking for a roommate", isOn: $draft.lookingForRoommate).tint(palette.accent)
                        CampusEntry(label: "Roommate preferences", text: list($draft.roommatePreferences))
                        Toggle("Offers tutoring", isOn: $draft.offersTutoring).tint(palette.accent)
                        CampusEntry(label: "Tutoring subjects", text: list($draft.tutoringSubjects))
                    }.padding(.top, 16)
                }
                DisclosureGroup("Links") { VStack(spacing: 16) {
                    CampusEntry(label: "Instagram", text: $draft.instagram)
                    CampusEntry(label: "LinkedIn", text: $draft.linkedin)
                    CampusEntry(label: "Portfolio", text: $draft.portfolioUrl)
                    CampusEntry(label: "Website", text: $draft.personalWebsite)
                }.textInputAutocapitalization(.never).keyboardType(.URL).padding(.top, 16) }
                if let error { Text(error).foregroundStyle(palette.urgent) }
                HStack { Spacer(); if busy { ProgressView() }; Button("Save") { Task { await save() } }.font(CampusFont.bold(16)).frame(minHeight: 44) }
            }.padding(20).disabled(busy) }.scrollDismissesKeyboard(.interactively)
        }.background(palette.background).foregroundStyle(palette.text).buttonStyle(CampusPressStyle()).interactiveDismissDisabled(busy)
    }
    private func save() async {
        guard !busy else { return }; busy = true; error = nil; defer { busy = false }
        do {
            if !year.trimmingCharacters(in: .whitespaces).isEmpty, Int(year) == nil { throw CampusError.invalidPost("Check the graduation year.") }
            draft.graduationYear = Int(year)
            _ = try await model.writeCampus(.profile, body: draft.encoded(), owner: owner)
            await model.refreshAccountIfSignedIn(); await model.refreshFeed(); dismiss()
        } catch { self.error = error.localizedDescription }
    }
}


/// Foreground-only coarse location. No coordinate is stored in preferences or Keychain.
@MainActor final class NativeDiscoveryLocation: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published private(set) var coordinate: CampusCoordinate?
    @Published private(set) var error: String?
    private let manager = CLLocationManager()
    private var visible = false, active = true, enabled = true
    override init() {
        super.init(); manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyKilometer; manager.distanceFilter = 250
    }
    func appear() { visible = true; updateAuthorization() }
    func disappear() { visible = false; manager.stopUpdatingLocation() }
    func setActive(_ active: Bool) { self.active = active; updateAuthorization() }
    func chooseLocation() {
        enabled = true; error = nil
        switch manager.authorizationStatus {
        case .notDetermined: manager.requestWhenInUseAuthorization()
        case .restricted, .denied: error = "Enable location for Campus Mint in iPhone Settings."
        default: updateAuthorization()
        }
    }
    func useCampus() { enabled = false; coordinate = nil; error = nil; manager.stopUpdatingLocation() }
    private func updateAuthorization() {
        guard visible, active, enabled else { manager.stopUpdatingLocation(); return }
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse: manager.startUpdatingLocation()
        default: coordinate = nil; manager.stopUpdatingLocation()
        }
    }
    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor [weak self] in self?.updateAuthorization() }
    }
    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let value = locations.last, value.horizontalAccuracy >= 0, abs(value.timestamp.timeIntervalSinceNow) < 120 else { return }
        let point = CampusCoordinate(latitude: value.coordinate.latitude, longitude: value.coordinate.longitude)
        Task { @MainActor [weak self] in
            guard let self, visible, active, enabled, point.valid else { return }
            if let old = coordinate {
                let distance = CLLocation(latitude: old.latitude, longitude: old.longitude).distance(from: CLLocation(latitude: point.latitude, longitude: point.longitude))
                if distance < 250 { return }
            }
            coordinate = point; error = nil
        }
    }
    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor [weak self] in
            guard let self, visible, active, enabled else { return }
            self.error = "Location unavailable. Showing campus results."
            coordinate = nil
        }
    }
}

struct NativePlaceDetail: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    let place: NearbyPlace
    @State private var details: PlaceDetails?
    @State private var reviews: PlaceReviews?
    @State private var photos: [PlacePhoto] = []
    @State private var photoIndex = 0
    @State private var noMorePhotos = false
    @State private var busy = false
    @State private var error: String?
    var body: some View {
        VStack(spacing: 0) {
            CampusPanelHeader(title: place.title)
            ScrollView { VStack(alignment: .leading, spacing: 18) {
                Text(place.address).font(CampusFont.regular(14))
                if let rating = place.rating { Text("\(rating, specifier: "%.1f") ★ · \(place.ratingCount ?? 0)").font(CampusFont.bold(14)) }
                if let details {
                    if let open = details.openNow { Text(open ? "Open now" : "Closed").foregroundStyle(open ? palette.personal : palette.secondary) }
                    ForEach(details.hours, id: \.self) { Text($0).font(CampusFont.regular(12)) }
                    if let url = campusWebURL(details.website) { Link("Website", destination: url) }
                    if let phone = details.phone { Text(phone).textSelection(.enabled) }
                    attribution(details.attributions)
                }
                if let url = campusWebURL(place.sourceUrl) { HStack { Link("Google Maps", destination: url); Spacer(); ShareLink(item: url) { Label("Share", systemImage: "square.and.arrow.up") } } }
                ForEach(Array(photos.enumerated()), id: \.offset) { _, photo in
                    if let url = campusWebURL(photo.url) { AsyncImage(url: url) { $0.resizable().scaledToFit() } placeholder: { ProgressView() }.clipShape(RoundedRectangle(cornerRadius: 20)) }
                    attribution(photo.authors)
                    if let url = campusWebURL(photo.sourceUrl) { Link("Photo on Google Maps", destination: url).font(CampusFont.regular(12)) }
                }
                if !noMorePhotos && photoIndex < 5 { Button(photos.isEmpty ? "Photos" : "More photos") { Task { await loadPhoto() } }.disabled(busy) }
                if let reviews {
                    ForEach(Array(reviews.reviews.enumerated()), id: \.offset) { _, review in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack { if let url = campusWebURL(review.authorUrl) { Link(review.author, destination: url) } else { Text(review.author) }; Spacer(); Text("\(review.rating, specifier: "%.0f") ★") }
                            Text(review.text).font(CampusFont.regular(14))
                            if let url = campusWebURL(review.url) { Link("Review on Google Maps", destination: url).font(CampusFont.regular(12)) }
                        }.padding(.vertical, 8)
                    }
                    if reviews.reviews.isEmpty { Text("No reviews") }
                    attribution(reviews.attributions)
                } else { Button("Reviews") { Task { await loadReviews() } }.disabled(busy) }
                if busy { ProgressView() }; if let error { Text(error).foregroundStyle(palette.urgent) }
                attribution(place.attributions ?? [])
            }.padding(20) }
        }.background(palette.background).foregroundStyle(palette.text).buttonStyle(CampusPressStyle())
            .task { await loadDetails() }
    }
    private func attribution(_ values: [PlaceAttribution]) -> some View {
        ForEach(Array(values.enumerated()), id: \.offset) { _, value in
            Group { if let url = campusWebURL(value.url) { Link(value.name, destination: url) } else { Text(value.name) } }.font(CampusFont.regular(11)).foregroundStyle(palette.secondary)
        }
    }
    private func loadDetails() async {
        guard let api = model.api, let id = place.googlePlaceId else { return }
        do { let result: PlaceDetails = try await api.placeResource(id: id, view: .details); try Task.checkCancellation(); details = result }
        catch { if !Task.isCancelled { self.error = error.localizedDescription } }
    }
    private func loadReviews() async {
        guard !busy, let api = model.api, let id = place.googlePlaceId else { return }; busy = true; error = nil; defer { busy = false }
        do { let result: PlaceReviews = try await api.placeResource(id: id, view: .reviews); try Task.checkCancellation(); reviews = result }
        catch { if !Task.isCancelled { self.error = error.localizedDescription } }
    }
    private func loadPhoto() async {
        guard !busy, let api = model.api, let id = place.googlePlaceId else { return }; busy = true; error = nil; defer { busy = false }
        do { let result: PlacePhotoResponse = try await api.placeResource(id: id, view: .photo(photoIndex)); try Task.checkCancellation(); if let photo = result.photo { photos.append(photo); photoIndex += 1 } else { noMorePhotos = true } }
        catch { if !Task.isCancelled { self.error = error.localizedDescription } }
    }
}

struct NativePeopleView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    var resource: SocialDetail = .people
    var title = "People"
    var choose: ((SocialPerson) -> Void)? = nil
    @State private var search = ""
    @State private var people: [SocialPerson] = []
    @State private var hasMore = false
    @State private var loading = false
    @State private var generation = UUID()
    @State private var error: String?
    @State private var selected: SocialPerson?
    var body: some View {
        VStack(spacing: 12) {
            CampusPanelHeader(title: title)
            HStack { Image(systemName: "magnifyingglass"); TextField("Search people", text: $search).textInputAutocapitalization(.never).autocorrectionDisabled() }.padding(.horizontal, 20).frame(minHeight: 44)
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    ForEach(people) { person in
                        Button { if let choose { choose(person) } else { selected = person } } label: {
                            HStack(spacing: 12) { CampusAvatar(name: person.name); VStack(alignment: .leading, spacing: 4) { Text(person.name).font(CampusFont.bold(15)); Text("@" + person.username).font(CampusFont.regular(12)).foregroundStyle(palette.secondary) }; Spacer() }.frame(minHeight: 56)
                        }.foregroundStyle(palette.text)
                    }
                    if loading { ProgressView().frame(maxWidth: .infinity) }
                    if !loading && people.isEmpty && error == nil { Text("No people found").foregroundStyle(palette.secondary).frame(maxWidth: .infinity, minHeight: 100) }
                    if let error { CampusFailure(message: error) { Task { await load() } } }
                    if hasMore { Button("More") { Task { await load(more: true) } }.frame(minHeight: 44).disabled(loading) }
                }.padding(20)
            }.refreshable { await load() }
        }.background(palette.background).buttonStyle(CampusPressStyle())
            .task(id: search) { do { try await Task.sleep(for: .milliseconds(300)); try Task.checkCancellation(); await load() } catch {} }
            .sheet(item: $selected) { person in NativePersonProfile(person: person, blocked: resource == .blocked).presentationBackground(palette.background) }
            .onChange(of: selected?.id) { old, new in if old != nil && new == nil { Task { await load() } } }
    }
    private func load(more: Bool = false) async {
        guard let api = model.api else { return }
        if more && loading { return }
        let ticket = UUID(); generation = ticket; loading = true; error = nil
        defer { if generation == ticket { loading = false } }
        if !more { people = [] }
        do {
            let page: SocialDirectory = try await api.socialDetail(resource, search: String(search.prefix(80)), after: more ? people.last?.id : nil)
            guard generation == ticket, !Task.isCancelled else { return }
            people = more ? people + page.items.filter { next in !people.contains(where: { $0.id == next.id }) } : page.items
            hasMore = page.hasMore
        } catch { if generation == ticket && !Task.isCancelled { self.error = error.localizedDescription; hasMore = false } }
    }
}

struct NativePersonProfile: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    @Environment(\.dismiss) private var dismiss
    let person: SocialPerson
    var blocked = false
    @State private var current: SocialPerson?
    @State private var message = false
    @State private var busy = false
    @State private var error: String?
    private var displayed: SocialPerson { current ?? person }
    var body: some View {
        VStack(spacing: 0) {
            CampusPanelHeader(title: "Profile")
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    CampusAvatar(name: displayed.name, size: 80)
                    Text(displayed.name).font(CampusFont.black(25))
                    Text("@" + displayed.username).foregroundStyle(palette.secondary)
                    if !blocked && current != nil {
                        if let bio = displayed.bio { Text(bio) }; if let major = displayed.major { Text(major).foregroundStyle(palette.secondary) }
                        HStack(spacing: 20) {
                            if displayed.canFollow || displayed.following { Button(displayed.following ? "Unfollow" : "Follow") { Task { await act("follow", enabled: !displayed.following) } }.frame(minHeight: 44) }
                            if displayed.canMessage { Button("Message") { message = true }.frame(minHeight: 44) }
                            Button("Block", role: .destructive) { Task { await act("block", enabled: true) } }.frame(minHeight: 44)
                        }.font(CampusFont.bold(14)).foregroundStyle(palette.accent)
                        ForEach(model.posts.filter { $0.authorId == person.id }) { post in MintPostView(post: post, author: model.authors[person.id]) }
                    } else if blocked { Button("Unblock") { Task { await act("block", enabled: false) } }.frame(minHeight: 44).foregroundStyle(palette.accent) }
                    if busy { ProgressView() }; if let error { Text(error).foregroundStyle(palette.urgent) }
                }.padding(20).frame(maxWidth: .infinity, alignment: .leading).disabled(busy)
            }
        }.background(palette.background).buttonStyle(CampusPressStyle())
            .task { if !blocked { for await _ in model.socialChanges.updates() { if Task.isCancelled { break }; await refresh() } } }
            .sheet(isPresented: $message) { NavigationStack { MessageThreadView(peer: person.id, name: displayed.name) }.presentationBackground(palette.background) }
    }
    private func refresh() async {
        do { guard let api = model.api else { return }; let result: SocialDirectory = try await api.socialDetail(.profile, target: person.id); current = result.items.first; error = nil }
        catch { current = nil; self.error = error.localizedDescription }
    }
    private func act(_ action: String, enabled: Bool) async {
        guard !busy else { return }; busy = true; error = nil; defer { busy = false }
        do { try await model.mutateSocial(.init(action: action, target: person.id, enabled: enabled)); if action == "block" { await model.refreshFeed(); dismiss() } else { await refresh() } }
        catch { self.error = error.localizedDescription }
    }
}

struct NativePostActions: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let postID: UUID
    @Binding var commentCount: Int?
    @Binding var canComment: Bool
    @State private var visible = false
    @State private var state: PostInteractions?
    @State private var busy = false
    @State private var error: String?
    @State private var burst = false
    var body: some View {
        HStack(spacing: 2) {
            Button { Task { await mutate("appreciate", enabled: !(state?.appreciated ?? false)) } } label: {
                Image(systemName: state?.appreciated == true ? "heart.fill" : "heart").scaleEffect(burst && !reduceMotion ? 1.3 : 1).frame(width: 44, height: 44)
            }.accessibilityLabel(state?.appreciated == true ? "Remove appreciation" : "Appreciate")
            Button { Task { await mutate("save", enabled: !(state?.saved ?? false)) } } label: { Image(systemName: state?.saved == true ? "bookmark.fill" : "bookmark").frame(width: 44, height: 44) }.accessibilityLabel(state?.saved == true ? "Unsave post" : "Save post")
            Button { Task { await mutate("endorse", enabled: !(state?.endorsed ?? false)) } } label: { Image(systemName: state?.endorsed == true ? "hand.thumbsup.fill" : "hand.thumbsup").frame(width: 44, height: 44) }.accessibilityLabel(state?.endorsed == true ? "Remove endorsement" : "Endorse")
            if let error { Button { Task { await load() } } label: { Image(systemName: "exclamationmark.circle").frame(width: 44, height: 44) }.accessibilityLabel(error + ". Retry") }
        }.foregroundStyle(palette.accent).disabled(busy || state == nil && error == nil)
            .modifier(CampusVisibleOnScreen(visible: $visible))
            .task(id: visible) {
                guard visible else { return }
                for await _ in model.socialChanges.updates() { if Task.isCancelled { break }; await load() }
            }
    }
    private func load() async {
        do { guard let api = model.api else { return }; state = try await api.socialDetail(.post, target: postID); try Task.checkCancellation(); commentCount = state?.commentCount; canComment = state?.commentsEnabled ?? true; error = nil }
        catch { if !Task.isCancelled { self.error = error.localizedDescription; state = nil; commentCount = nil; canComment = false } }
    }
    private func mutate(_ action: String, enabled: Bool) async {
        guard !busy, state != nil else { await load(); return }; busy = true; error = nil; defer { busy = false }
        do {
            try await model.mutateSocial(.init(action: action, target: postID, enabled: enabled)); await load()
            if enabled && ["appreciate", "endorse"].contains(action), let owner = model.account?.id {
                let signal = try FeedPreferenceWrite(post: postID, weight: action == "appreciate" ? 2 : 3)
                _ = try await model.writeCampus(.preference, body: JSONEncoder().encode(signal), owner: owner)
            }
            if action == "appreciate" && enabled { withAnimation(.spring(response: 0.25)) { burst = true }; UIImpactFeedbackGenerator(style: .light).impactOccurred(); try? await Task.sleep(for: .milliseconds(200)); withAnimation { burst = false } }
        } catch { self.error = error.localizedDescription }
    }
}

struct NativeNoteEditor: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    let close: () -> Void
    @Binding var busy: Bool
    @State private var bodyText = ""
    @State private var website = ""
    @State private var ready = false
    @State private var error: String?
    var body: some View {
        VStack(spacing: 0) {
            HStack { Text("Note").font(CampusFont.black(20)); Spacer(); CampusIconButton(icon: "xmark", label: "Close note") { close() }.disabled(busy) }.padding(.horizontal, 20)
            VStack(alignment: .leading, spacing: 16) {
                TextField("Your note", text: $bodyText, axis: .vertical).lineLimit(3...5).textFieldStyle(.plain).accessibilityLabel("Note text")
                Text("\(bodyText.utf16.count)/150").font(CampusFont.regular(12)).foregroundStyle(palette.secondary)
                CampusEntry(label: "Link", text: $website).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                if let error { CampusFailure(message: error) { Task { await load() } } }
                HStack { if busy { ProgressView() }; Spacer(); Button("Save") { Task { await save() } }.frame(minHeight: 44).disabled(!ready || busy || bodyText.utf16.count > 150) }.foregroundStyle(palette.accent)
            }.padding(20).disabled(busy)
        }.padding(.top, 12).background(palette.surface, in: RoundedRectangle(cornerRadius: 32))
            .task { await load() }
    }
    private func load() async {
        do { guard let api = model.api else { return }; let response: SocialNote = try await api.socialDetail(.note); bodyText = response.note?.body ?? ""; website = response.note?.website ?? ""; ready = true; error = nil }
        catch { self.error = error.localizedDescription }
    }
    private func save() async {
        guard !busy, ready else { return }; busy = true; error = nil; defer { busy = false }
        do {
            let link = website.trimmingCharacters(in: .whitespacesAndNewlines)
            if !link.isEmpty && campusWebURL(link) == nil { throw CampusError.invalidPost("Use an HTTPS link.") }
            try await model.mutateSocial(.init(action: "note", body: bodyText, website: link.isEmpty ? nil : link)); close()
        } catch { self.error = error.localizedDescription }
    }
}

struct NativePrivacyView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    @State private var values: [String: String] = [:]
    @State private var changed: [String: String] = [:]
    @State private var busy = false
    @State private var error: String?
    private let fields = [("accountType","Account"),("bio","Profile visibility"),("classes","Classes"),("clubs","Clubs"),("major","Major"),("graduationYear","Graduation year"),("interests","Interests"),("hometown","Hometown"),("instagram","Instagram"),("linkedin","LinkedIn"),("portfolioUrl","Portfolio"),("personalWebsite","Website")]
    var body: some View {
        VStack(spacing: 0) {
            CampusPanelHeader(title: "Privacy")
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(fields, id: \.0) { key, label in
                        HStack { Text(label).font(CampusFont.bold(14)); Spacer()
                            Picker(label, selection: Binding(get: { changed[key] ?? values[key] ?? "private" }, set: { changed[key] = $0 })) {
                                if key == "accountType" { Text("Public").tag("public"); Text("Private").tag("private") }
                                else { Text("Everyone").tag("everyone"); Text("Students").tag("students_only"); Text("Friends").tag("friends_only"); Text("Only me").tag("private") }
                            }.labelsHidden().tint(palette.accent)
                        }.frame(minHeight: 44)
                    }
                    if let error { Text(error).foregroundStyle(palette.urgent) }
                    HStack { if busy { ProgressView() }; Spacer(); Button("Save") { Task { await save() } }.frame(minHeight: 44).disabled(changed.isEmpty || busy) }.foregroundStyle(palette.accent)
                }.padding(20).disabled(busy)
            }
        }.background(palette.background).task { values = model.account?.privacy ?? [:]; values["accountType"] = model.account?.socialSettings?["accountType"] ?? "private" }.interactiveDismissDisabled(busy)
    }
    private func save() async {
        guard !busy, let owner = model.account?.id else { return }; busy = true; error = nil; defer { busy = false }
        do { _ = try await model.writeCampus(.privacy, body: JSONEncoder().encode(changed), owner: owner); values.merge(changed) { _, next in next }; changed = [:]; await model.refreshAccountIfSignedIn(); await model.refreshFeed() }
        catch { self.error = error.localizedDescription }
    }
}

struct NativeProfileLoader: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    let id: UUID
    @State private var person: SocialPerson?
    @State private var error: String?
    var body: some View {
        Group { if let person { NativePersonProfile(person: person) }
            else if let error { CampusFailure(message: error) { Task { await load() } } }
            else { ProgressView() }
        }.frame(maxWidth: .infinity, maxHeight: .infinity).background(palette.background).task { await load() }
    }
    private func load() async {
        do { guard let api = model.api else { return }; let response: SocialDirectory = try await api.socialDetail(.profile, target: id); person = response.items.first; error = nil }
        catch { self.error = error.localizedDescription }
    }
}

struct NativeSavedPosts: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    @State private var posts: [MintPost] = []
    @State private var authors: [UUID: CampusUser] = [:]
    @State private var cursor: UUID?
    @State private var hasMore = false
    @State private var loading = false
    @State private var error: String?
    var body: some View {
        VStack(spacing: 0) {
            CampusPanelHeader(title: "Saved")
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(posts) { post in MintPostView(post: post, author: authors[post.authorId]) }
                    if loading { ProgressView() }
                    if let error { CampusFailure(message: error) { Task { await load() } } }
                    if posts.isEmpty && !loading && error == nil { Text("No saved posts").foregroundStyle(palette.secondary).padding(40) }
                    if hasMore { Button("More") { Task { await load(more: true) } }.frame(minHeight: 44).disabled(loading) }
                }.padding(12)
            }.refreshable { await load() }
        }.background(palette.background).task { await load() }
    }
    private func load(more: Bool = false) async {
        guard !loading, let api = model.api else { return }; loading = true; error = nil; defer { loading = false }
        do {
            let page: SavedPosts = try await api.socialDetail(.saved, after: more ? cursor : nil)
            let next = page.items.isEmpty ? nil : try await api.feed(ids: page.items.map(\.id))
            try Task.checkCancellation()
            posts = more ? posts + (next?.mintz ?? []).filter { item in !posts.contains(where: { $0.id == item.id }) } : next?.mintz ?? []
            for author in next?.authors ?? [] { authors[author.id] = author }
            cursor = page.items.last?.id; hasMore = page.hasMore
        } catch { posts = []; authors = [:]; hasMore = false; self.error = error.localizedDescription }
    }
}

struct NativeStudentSetupView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    @State private var first = ""
    @State private var last = ""
    @State private var username = ""
    @State private var sports = Set<String>()
    @State private var busy = false
    @State private var error: String?
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Your profile").font(CampusFont.black(30))
                CampusEntry(label: "First name", text: $first).textContentType(.givenName)
                CampusEntry(label: "Last name", text: $last).textContentType(.familyName)
                CampusEntry(label: "Username", text: $username).textContentType(.username).textInputAutocapitalization(.never).autocorrectionDisabled()
                if let choices = model.pendingStudent?.studentSetup?.sports, !choices.isEmpty {
                    Text("Sports interests · Optional").font(CampusFont.bold(14))
                    ForEach(choices) { sport in
                        Button { if sports.contains(sport.id) { sports.remove(sport.id) } else { sports.insert(sport.id) } } label: { HStack { Text(sport.label); Spacer(); if sports.contains(sport.id) { Image(systemName: "checkmark") } }.frame(minHeight: 44) }.foregroundStyle(sports.contains(sport.id) ? palette.accent : palette.text)
                    }
                }
                if let error { Text(error).foregroundStyle(palette.urgent) }
                if busy { ProgressView() }
                Button("Continue") { Task { await save() } }.font(CampusFont.bold(16)).foregroundStyle(palette.accent).frame(minHeight: 44)
                Button("Sign out") { Task { await model.signOut() } }.frame(minHeight: 44).foregroundStyle(palette.secondary)
            }.padding(24).disabled(busy)
        }.background(palette.background).buttonStyle(CampusPressStyle())
    }
    private func save() async {
        guard !busy else { return }; busy = true; error = nil; defer { busy = false }
        do { try await model.finishStudentSignup(StudentSignup(firstName: first, lastName: last, username: username, sports: Array(sports))) }
        catch { self.error = error.localizedDescription }
    }
}

struct NativeSportsInterests: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    @Environment(\.dismiss) private var dismiss
    let profile: AthleticsProfile
    @State private var selected = Set<String>()
    @State private var busy = false
    @State private var error: String?
    var body: some View {
        VStack(spacing: 0) {
            CampusPanelHeader(title: "Sports interests")
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    Button("Automatic seasonal lineup") { selected = [] }.font(CampusFont.bold(14)).foregroundStyle(palette.accent).frame(minHeight: 44)
                    ForEach(profile.supportedSports, id: \.self) { id in
                        if let sport = profile.programs[id] {
                            Button { if selected.contains(id) { selected.remove(id) } else { selected.insert(id) } } label: { HStack { Text(sport.label); Spacer(); if selected.contains(id) { Image(systemName: "checkmark") } }.frame(minHeight: 44) }.foregroundStyle(selected.contains(id) ? palette.accent : palette.text)
                        }
                    }
                    if let error { Text(error).foregroundStyle(palette.urgent) }
                    if busy { ProgressView() }
                    Button("Save") { Task { await save() } }.font(CampusFont.bold(15)).foregroundStyle(palette.accent).frame(minHeight: 44)
                }.padding(20).disabled(busy)
            }
        }.background(palette.background).interactiveDismissDisabled(busy)
            .task { selected = Set(model.account?.profile.sportsInterests ?? []).intersection(Set(profile.supportedSports)) }
    }
    private func save() async {
        guard !busy, let owner = model.account?.id else { return }; busy = true; error = nil; defer { busy = false }
        do { _ = try await model.writeCampus(.profile, body: JSONEncoder().encode(["sportsInterests": Array(selected).sorted()]), owner: owner); await model.refreshAccountIfSignedIn(); dismiss() }
        catch { self.error = error.localizedDescription }
    }
}

struct NativeNotInterested: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    let post: UUID
    @State private var busy = false
    var body: some View {
        Menu { Menu("Not interested") {
            ForEach(["creator", "content", "relevance"], id: \.self) { reason in Button(reason.capitalized) { Task { await hide(reason) } } }
        } } label: { Image(systemName: "ellipsis").frame(width: 44, height: 44) }.accessibilityLabel("Post options").foregroundStyle(palette.secondary).disabled(busy)
    }
    private func hide(_ reason: String) async {
        guard !busy, let owner = model.account?.id else { return }; busy = true; defer { busy = false }
        do { _ = try await model.writeCampus(.preference, body: JSONEncoder().encode(FeedPreferenceWrite(post: post, reason: reason)), owner: owner); model.posts.removeAll { UUID(uuidString: $0.id) == post }; await model.refreshFeed() }
        catch { model.message = error.localizedDescription }
    }
}


struct NativeContextDestination: Identifiable { let id = UUID(); let kind: NotificationDestination }
struct NativeNotificationDestination: View {
    let destination: NotificationDestination
    let name: String
    var body: some View {
        switch destination {
        case .message(let id): MessageThreadView(peer: id, name: name)
        case .profile(let id): NativeProfileLoader(id: id)
        case .club(let id): NativeClubDetail(id: id.uuidString.lowercased(), changed: {})
        case .event(let id): NativeEventDetail(id: id)
        }
    }
}

struct NativeEventDetail: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    let id: UUID
    @State private var event: CampusEvent?
    @State private var attending: Bool?
    @State private var error: String?
    @State private var busy = false
    var body: some View {
        VStack(spacing: 0) {
            CampusPanelHeader(title: "Event")
            ScrollView { VStack(alignment: .leading, spacing: 18) {
                if let event {
                    if let url = campusWebURL(event.source?.officialImageUrl) { AsyncImage(url: url) { $0.resizable().scaledToFit() } placeholder: { ProgressView() } }
                    Text(event.title).font(CampusFont.black(24))
                    if let date = campusDate(event.eventStartAt) { Text(date, format: .dateTime.month().day().year().hour().minute()).font(CampusFont.bold(14)) }
                    Text(event.location); if let address = event.address { Text(address).foregroundStyle(palette.secondary) }
                    if !event.description.isEmpty { Text(event.description).textSelection(.enabled) }
                    HStack {
                        if let attending { Button(attending ? "Going ✓" : "I'm going") { Task { await toggleAttendance() } }.disabled(busy) }
                        Spacer()
                        if let url = campusWebURL("https://www.thecampusmint.com/share/event/" + id.uuidString.lowercased()) { ShareLink(item: url) { Label("Share", systemImage: "square.and.arrow.up") } }
                    }.frame(minHeight: 44).foregroundStyle(palette.accent)
                    if let url = campusWebURL(event.source?.sourceUrl) { Link(event.source?.sourceTitle ?? "Website", destination: url).font(CampusFont.bold(12)) }
                } else if error == nil { ProgressView() }
                if let error { CampusFailure(message: error) { Task { await load() } } }
            }.padding(20).frame(maxWidth: .infinity, alignment: .leading) }.refreshable { await load() }
        }.background(palette.background).task { for await _ in model.socialChanges.updates() { if Task.isCancelled { break }; await load() } }
    }
    private func load() async {
        do {
            guard let api = model.api else { return }
            let response: EventsResponse = try await api.campusResource(.events)
            try Task.checkCancellation()
            event = response.events.first { $0.id == id }
            guard event != nil else { attending = nil; error = "Event unavailable"; return }
            let status: EventAttendance = try await api.socialDetail(.attendance, target: id)
            attending = status.attending; error = nil
        } catch { event = nil; attending = nil; if !Task.isCancelled { self.error = error.localizedDescription } }
    }
    private func toggleAttendance() async {
        guard !busy, let attending else { return }; busy = true; defer { busy = false }
        do { try await model.mutateSocial(.init(action: "attendance", target: id, enabled: !attending)); await load() }
        catch { self.error = error.localizedDescription }
    }
}

/// Record only a completed share. Cancelling the system sheet is not an interaction.
struct NativeMintShare: View {
    @EnvironmentObject private var model: AppModel
    let post: UUID; let url: URL
    @State private var showing = false
    @State private var requestID = UUID()
    @State private var error: String?
    var body: some View {
        Button { requestID = UUID(); showing = true } label: { Label("Share", systemImage: "square.and.arrow.up").font(CampusFont.bold(12)).frame(minHeight: 44) }.accessibilityLabel("Share Mint")
            .sheet(isPresented: $showing) {
                NativeActivitySheet(url: url) { completed, channel in
                    showing = false
                    guard completed else { return }
                    let owner = model.account?.id
                    Task {
                        guard owner != nil, model.account?.id == owner else { return }
                        do { try await model.mutateSocial(.init(action: "share", target: post, requestID: requestID, channel: channel)) }
                        catch { self.error = "Shared. Your account activity couldn't sync." }
                    }
                }.presentationDetents([.medium, .large])
            }
            .alert("Share", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("OK") { error = nil } } message: { Text(error ?? "") }
    }
}
struct NativeActivitySheet: UIViewControllerRepresentable {
    let url: URL
    let completion: (Bool, String) -> Void
    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        controller.completionWithItemsHandler = { activity, completed, _, _ in
            Task { @MainActor in completion(completed, activity == .copyToPasteboard ? "copy_link" : "external") }
        }
        return controller
    }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}


private struct CampusVisibleOnScreen: ViewModifier {
    @Binding var visible: Bool
    func body(content: Content) -> some View {
        if #available(iOS 18.0, *) {
            content.onScrollVisibilityChange(threshold: 0.1) { visible = $0 }
        } else {
            content.background {
                GeometryReader { geometry in
                    Color.clear.onChange(of: geometry.frame(in: .global), initial: true) { _, frame in
                        visible = !frame.isEmpty && frame.intersects(UIScreen.main.bounds)
                    }
                }
            }.onDisappear { visible = false }
        }
    }
}
