import SwiftUI
import CampusMintCore

private enum CampusTab: String, CaseIterable { case messages = "Messages", mint = "Mint", sports = "Sports", groups = "Groups" }
private enum CampusPanel: String, Identifiable { case settings, notifications, profile, search; var id: String { rawValue } }

struct CampusShell: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var tab = CampusTab.mint
    @State private var panel: CampusPanel?
    @State private var composing = false
    @State private var posting = false
    @Namespace private var selection
    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                header
                Group {
                    switch tab {
                    case .messages: MessagesView()
                    case .mint: FeedView()
                    case .sports: CampusSportsView()
                    case .groups: CampusClubsView()
                    }
                }.frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .safeAreaInset(edge: .bottom, spacing: 0) { notch.padding(.top, 6).padding(.bottom, 6) }
            if composing {
                palette.background.opacity(0.65).ignoresSafeArea().onTapGesture { if !posting { composing = false } }
                GeometryReader { geometry in
                    TextComposer(onClose: { composing = false }, posting: $posting, maximumHeight: max(180, min(520, geometry.size.height - 24)))
                        .padding(.horizontal, 12).frame(maxWidth: 464)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }.transition(.scale(scale: 0.96).combined(with: .opacity))
            }
        }
        .buttonStyle(CampusPressStyle())
        .animation(reduceMotion ? nil : .spring(response: 0.34, dampingFraction: 0.86), value: composing)
        .sheet(item: $panel) { panel in
            Group {
                switch panel {
                case .settings: CampusSettingsView()
                case .notifications: NotificationsView()
                case .profile: ProfileView()
                case .search: CampusDiscoveryView()
                }
            }
            .environment(\.campusPalette, palette).foregroundStyle(palette.text)
            .font(CampusFont.regular(16)).tint(palette.accent)
            .presentationBackground(palette.background).presentationCornerRadius(32)
            .presentationDragIndicator(.hidden)
            .presentationDetents(panel == .settings ? [.height(620), .large] : [.large])
        }
    }
    private var header: some View {
        HStack(spacing: 0) {
            Button { panel = .settings } label: { CampusSprout().frame(width: 25, height: 28).frame(width: 44, height: 44) }.accessibilityLabel("Open settings")
            CampusIconButton(icon: "bell", label: "Open notifications") { panel = .notifications }
            Spacer(minLength: 0)
            Text(campusIdentities[model.account?.account.universityId ?? ""]?.name ?? "Campus Mint")
                .font(CampusFont.black(12, relativeTo: .caption)).lineLimit(1)
            Spacer(minLength: 0)
            CampusIconButton(icon: "magnifyingglass", label: "Open Search") { panel = .search }
            Button { panel = .profile } label: {
                CampusAvatar(name: model.account?.profile.displayName ?? "", size: 40).frame(width: 44, height: 44)
            }.accessibilityLabel("Open my profile")
        }.padding(.horizontal, 14).frame(height: 56)
    }
    private var notch: some View {
        HStack(spacing: 0) {
            tabButton(.messages); tabButton(.mint)
            Button { composing = true } label: {
                Image(systemName: "plus").font(.system(size: 20, weight: .medium)).frame(width: 52, height: 44).contentShape(Rectangle())
            }.accessibilityLabel("Create Mint").disabled(!model.canPublish)
            tabButton(.sports); tabButton(.groups)
        }.padding(.horizontal, 2).frame(maxWidth: 304)
            .background(palette.surface, in: Capsule()).padding(.horizontal, 24)
            .accessibilityElement(children: .contain).accessibilityLabel("Campus Mint primary navigation")
    }
    private func tabButton(_ item: CampusTab) -> some View {
        Button {
            withAnimation(reduceMotion ? nil : .spring(response: 0.3, dampingFraction: 0.85)) { tab = item }
        } label: {
            Text(item.rawValue).font(CampusFont.bold(11, relativeTo: .caption2)).lineLimit(1).minimumScaleFactor(0.8)
                .padding(.horizontal, 8).padding(.vertical, 6)
                .foregroundStyle(tab == item ? palette.accent : palette.secondary)
                .background {
                    if tab == item { Capsule().fill(palette.accentSoft).matchedGeometryEffect(id: "selected", in: selection) }
                }
                .frame(width: item == .messages ? 74 : item == .mint ? 54 : 60).frame(minHeight: 44).contentShape(Rectangle())
        }.accessibilityLabel("Go to \(item.rawValue)").accessibilityAddTraits(tab == item ? .isSelected : [])
    }
}

struct CampusSprout: View {
    var body: some View {
        Canvas { context, size in
            context.scaleBy(x: size.width / 24, y: size.height / 24)
            var p = Path()
            p.move(to: .init(x: 11, y: 23)); p.addCurve(to: .init(x: 18, y: 5), control1: .init(x: 10, y: 14), control2: .init(x: 13, y: 7))
            p.move(to: .init(x: 13, y: 10)); p.addCurve(to: .init(x: 22, y: 2), control1: .init(x: 12, y: 3), control2: .init(x: 20, y: 1)); p.addCurve(to: .init(x: 13, y: 10), control1: .init(x: 21, y: 8), control2: .init(x: 17, y: 10))
            p.move(to: .init(x: 11, y: 18)); p.addCurve(to: .init(x: 1, y: 12), control1: .init(x: 5, y: 20), control2: .init(x: 3, y: 15)); p.addCurve(to: .init(x: 11, y: 18), control1: .init(x: 7, y: 11), control2: .init(x: 10, y: 13))
            context.stroke(p, with: .foreground, style: .init(lineWidth: 1.8, lineCap: .round, lineJoin: .round))
        }.accessibilityHidden(true)
    }
}

struct CampusPanelHeader: View {
    @Environment(\.dismiss) private var dismiss
    let title: String
    var body: some View {
        HStack { Text(title).font(CampusFont.black(20, relativeTo: .title2)).accessibilityAddTraits(.isHeader); Spacer()
            CampusIconButton(icon: "xmark", label: "Close \(title)") { dismiss() }
        }.padding(.leading, 20).padding(.trailing, 12).frame(height: 64)
    }
}

struct CampusSettingsView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    @State private var custom = false
    private let tints: [CampusAccent] = [.slate, .warmGray, .forest, .deepNavy, .mutedMaroon]
    var body: some View {
        VStack(spacing: 0) {
            CampusPanelHeader(title: "Settings")
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Text("Appearance").font(CampusFont.black(18))
                    HStack(alignment: .top, spacing: 8) {
                        appearance(.light, description: "Bright surfaces", colors: [.white, Color(white: 0.94)])
                        appearance(.dark, description: "Low-light surfaces", colors: [Color(white: 0.04), Color(white: 0.14)])
                        appearance(.colorful, description: "Color with meaning", colors: [Color(red: 0.72, green: 0.26, blue: 0.28), Color(red: 0.66, green: 0.35, blue: 0.13), Color(red: 0.16, green: 0.46, blue: 0.31)])
                    }
                    if model.appearance == .colorful {
                        HStack(spacing: 12) {
                            semantic("Happening now", color: palette.urgent); semantic("Discover", color: palette.discovery); semantic("For you", color: palette.personal)
                        }
                    } else {
                        Text("ACCENT SOURCE").font(CampusFont.black(10, relativeTo: .caption2)).tracking(1.4).foregroundStyle(palette.secondary)
                        HStack {
                            choice("Campus Mint", selected: model.accentSelection == .brand) { custom = false; model.accentSelection = .brand }
                            choice("School", selected: model.accentSelection == .campus) { custom = false; model.accentSelection = .campus }
                            choice("Custom tint", selected: custom || tints.contains(model.accentSelection)) { custom = true; if !tints.contains(model.accentSelection) { model.accentSelection = .slate } }
                        }
                        Text("CUSTOM TINT").font(CampusFont.black(10, relativeTo: .caption2)).tracking(1.4).foregroundStyle(palette.secondary)
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 3), spacing: 8) {
                            ForEach(tints) { tint in
                                Button { custom = true; model.accentSelection = tint } label: {
                                    HStack(spacing: 7) { Circle().fill(tint.rgb(dark: false, school: model.schoolAccent).color).frame(width: 20, height: 20)
                                        Text(tint.label).font(CampusFont.bold(10, relativeTo: .caption2)).foregroundStyle(palette.text)
                                    }.frame(maxWidth: .infinity, minHeight: 44).background(model.accentSelection == tint ? palette.accentSoft : .clear, in: Capsule())
                                }.accessibilityAddTraits(model.accentSelection == tint ? .isSelected : [])
                            }
                        }
                    }
                    Toggle("HD / 4K uploads", isOn: $model.highQualityUploads)
                        .font(CampusFont.bold(14)).tint(palette.accent)
                    if let website = model.website {
                        Link("Account & privacy settings", destination: website).font(CampusFont.bold(14)).foregroundStyle(palette.accent).frame(minHeight: 44)
                            .accessibilityHint("Opens the Campus Mint website")
                    }
                }.padding(20)
            }
        }.background(palette.surface).buttonStyle(CampusPressStyle())
    }
    private func semantic(_ label: String, color: Color) -> some View {
        HStack(spacing: 5) { Circle().fill(color).frame(width: 6, height: 6); Text(label).font(CampusFont.bold(10, relativeTo: .caption2)) }.foregroundStyle(color)
    }
    private func choice(_ label: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) { Text(label).font(CampusFont.bold(11, relativeTo: .caption)).frame(maxWidth: .infinity, minHeight: 44).background(selected ? palette.accentSoft : .clear, in: Capsule()) }
            .foregroundStyle(palette.text).accessibilityAddTraits(selected ? .isSelected : [])
    }
    private func appearance(_ value: Appearance, description: String, colors: [Color]) -> some View {
        let stops = colors.enumerated().flatMap { index, color in
            [Gradient.Stop(color: color, location: CGFloat(index) / CGFloat(colors.count)), Gradient.Stop(color: color, location: CGFloat(index + 1) / CGFloat(colors.count))]
        }
        return Button { model.appearance = value } label: {
            VStack(alignment: .leading, spacing: 8) {
                LinearGradient(stops: stops, startPoint: .topLeading, endPoint: .bottomTrailing)
                    .frame(height: 48).clipShape(Capsule())
                Text(value.label).font(CampusFont.bold(14)).padding(.horizontal, 10).padding(.vertical, 6)
                    .foregroundStyle(model.appearance == value ? palette.accent : palette.text)
                    .background(model.appearance == value ? palette.accentSoft : .clear, in: Capsule())
                Text(description).font(CampusFont.regular(11, relativeTo: .caption)).foregroundStyle(palette.secondary)
                    .fixedSize(horizontal: false, vertical: true).padding(.horizontal, 10)
            }.frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 10)
        }.foregroundStyle(palette.text).accessibilityAddTraits(model.appearance == value ? .isSelected : [])
    }
}

struct CampusSportsView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    @State private var response: SportsResponse?
    @State private var selected = ""
    @State private var error: String?
    @State private var loading = false
    private var programs: [SportProgram] { response?.profile.recommendations(favorites: response?.sportsInterests ?? []) ?? [] }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let profile = response?.profile {
                    HStack(spacing: 12) {
                        Capsule().fill(palette.accent).frame(width: 5, height: 44).accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 5) {
                        Text("\(profile.divisionLabel) · \(profile.conferenceLabel)").font(CampusFont.bold(10, relativeTo: .caption2)).foregroundStyle(palette.secondary)
                        Text(profile.universityName).font(CampusFont.black(24, relativeTo: .title)).accessibilityAddTraits(.isHeader)
                        Text(profile.nickname).font(CampusFont.regular(14)).foregroundStyle(palette.secondary)
                    }
                    }
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Live / Current").font(CampusFont.black(16))
                        let live = programs.flatMap(\.games).filter { $0.status == "live" }
                        if live.isEmpty { Text("No games live right now").font(CampusFont.regular(13)).foregroundStyle(palette.secondary) }
                        ForEach(live) { game in gameRow(game) }
                        if live.isEmpty, let next = programs.flatMap({ program in program.games.compactMap { game -> (String, CampusGame)? in
                            guard let date = campusDate(game.date), date > Date(), game.status != "final" else { return nil }; return (program.label, game)
                        } }).sorted(by: { $0.1.date < $1.1.date }).first {
                            Text("Next: \(next.0) · \(next.1.opponentName) · \(next.1.dateLabel)").font(CampusFont.bold(11, relativeTo: .caption)).foregroundStyle(palette.secondary)
                        }
                    }.padding(16).frame(maxWidth: .infinity, alignment: .leading).background(palette.surface, in: RoundedRectangle(cornerRadius: 24))
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 2) {
                            ForEach(programs) { program in
                                Button { selected = program.id } label: {
                                    Text(program.label).font(CampusFont.bold(11, relativeTo: .caption)).padding(.horizontal, 14).padding(.vertical, 8)
                                        .foregroundStyle(selected == program.id ? palette.accentContrast : palette.secondary)
                                        .background(selected == program.id ? palette.accent : .clear, in: Capsule()).frame(minHeight: 44)
                                }.accessibilityAddTraits(selected == program.id ? .isSelected : [])
                            }
                        }.padding(.horizontal, 4).background(palette.surface, in: Capsule())
                    }.frame(maxWidth: .infinity).padding(.vertical, 4)
                    if let program = programs.first(where: { $0.id == selected }) ?? programs.first {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(program.seasonLabel).font(CampusFont.black(10, relativeTo: .caption2)).tracking(1.4).foregroundStyle(palette.secondary)
                            HStack(alignment: .firstTextBaseline) {
                                Text("\(program.label) schedule").font(CampusFont.black(20)); Spacer()
                                Text(program.seasonRecord() ?? "Record unavailable").font(CampusFont.regular(10, relativeTo: .caption2)).foregroundStyle(palette.secondary).accessibilityLabel("Season record \(program.seasonRecord() ?? "unavailable")")
                            }.padding(.bottom, 6)
                            ForEach(program.games) { game in
                                if let url = campusWebURL(game.boxScoreSourceUrl ?? game.scheduleSourceUrl ?? program.source.sourceUrl) {
                                    Link(destination: url) { gameRow(game) }.accessibilityHint("Opens the official game source")
                                } else { gameRow(game) }
                            }
                            if program.games.isEmpty { Text("Schedule unavailable").font(CampusFont.regular(14)).foregroundStyle(palette.secondary) }
                            if let url = campusWebURL(program.source.sourceUrl) { Link("Official source", destination: url).font(CampusFont.bold(12)).foregroundStyle(palette.accent).frame(minHeight: 44) }
                        }
                    }
                }
                if loading { ProgressView().frame(maxWidth: .infinity) }
                if let error { CampusFailure(message: error) { Task { await load() } } }
            }.padding(16).background(palette.raised, in: RoundedRectangle(cornerRadius: 32)).padding(.horizontal, 16).padding(.top, 4)
        }.task { await load() }.refreshable { await load() }
    }
    private func gameRow(_ game: CampusGame) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text(game.dateLabel).font(CampusFont.bold(12)).frame(width: 48, alignment: .leading)
            VStack(alignment: .leading, spacing: 5) {
                Text("\(game.homeAway == "away" ? "at" : "vs") \(game.opponentName)").font(CampusFont.bold(14))
                Text([game.homeAway.capitalized, game.location, game.timeLabel, game.network].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")).font(CampusFont.regular(10, relativeTo: .caption2)).foregroundStyle(palette.secondary).lineLimit(1)
            }
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 5) {
                Text(game.statusLabel()).font(CampusFont.bold(10, relativeTo: .caption2)).foregroundStyle(game.status == "live" ? palette.urgent : palette.secondary)
                if let score = game.campusScore, let opponent = game.opponentScore { Text("\(game.result ?? "") \(score)–\(opponent)").font(CampusFont.black(14)) }
            }
        }.foregroundStyle(palette.text).frame(maxWidth: .infinity, minHeight: 40, alignment: .leading).padding(.vertical, 10).padding(.horizontal, 14).background(palette.surface, in: RoundedRectangle(cornerRadius: 22))
    }
    private func load() async {
        guard !loading, let api = model.api, let id = model.account?.account.universityId else { return }
        loading = true; defer { loading = false }
        do { let result: SportsResponse = try await api.campusResource(.sports, query: [.init(name: "universityId", value: id)])
            guard !Task.isCancelled else { return }; response = result; error = nil
            if !programs.contains(where: { $0.id == selected }) { selected = programs.first?.id ?? "" }
        } catch { self.error = error.localizedDescription }
    }
}

struct CampusClubsView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    @State private var clubs: [CampusClub] = []
    @State private var query = ""
    @State private var mine = false
    @State private var loading = false
    @State private var error: String?
    @State private var selected: CampusClub?
    private var filtered: [CampusClub] { clubs.filter { (!mine || ["leader", "officer", "member"].contains($0.role ?? "")) && (query.isEmpty || $0.name.localizedCaseInsensitiveContains(query)) } }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack { Text("Clubs").font(CampusFont.black(24, relativeTo: .title)); Spacer()
                    if let website = model.website { Link("+ Create Club", destination: website).font(CampusFont.bold(12)).foregroundStyle(palette.accent).accessibilityHint("Opens club creation on the website") }
                }
                HStack(spacing: 8) {
                    Button { mine = false } label: { Text("Discover").padding(.horizontal, 12).padding(.vertical, 8).background(!mine ? palette.accentSoft : .clear, in: Capsule()) }.foregroundStyle(!mine ? palette.accent : palette.secondary).accessibilityAddTraits(!mine ? .isSelected : [])
                    Button { mine = true } label: { Text("My clubs").padding(.horizontal, 12).padding(.vertical, 8).background(mine ? palette.accentSoft : .clear, in: Capsule()) }.foregroundStyle(mine ? palette.accent : palette.secondary).accessibilityAddTraits(mine ? .isSelected : [])
                }.font(CampusFont.bold(14)).frame(minHeight: 44)
                TextField("Search clubs", text: $query, prompt: Text("Search clubs").foregroundStyle(palette.secondary)).font(CampusFont.regular(14)).padding(.horizontal, 12).frame(height: 48).background(palette.raised, in: RoundedRectangle(cornerRadius: 16))
                if loading { ProgressView().frame(maxWidth: .infinity).padding(32) }
                else if let error { CampusFailure(message: error) { Task { await load() } } }
                else if filtered.isEmpty { Text("No clubs yet").font(CampusFont.regular(14)).foregroundStyle(palette.secondary).frame(maxWidth: .infinity).padding(.vertical, 64) }
                ForEach(filtered) { club in
                    Button { selected = club } label: {
                        VStack(alignment: .leading, spacing: 10) {
                            Text(club.name).font(CampusFont.black(18)); Text(club.summary).font(CampusFont.regular(14)).foregroundStyle(palette.secondary)
                            Text("\(club.memberCount) members").font(CampusFont.bold(11, relativeTo: .caption)).foregroundStyle(palette.discovery)
                        }.frame(maxWidth: .infinity, alignment: .leading).padding(20).background(palette.surface, in: RoundedRectangle(cornerRadius: 24))
                    }.foregroundStyle(palette.text)
                }
            }.padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 16)
        }.task { await load() }.refreshable { await load() }
        .sheet(item: $selected) { club in
            VStack(spacing: 0) {
                CampusPanelHeader(title: club.name)
                ScrollView { VStack(alignment: .leading, spacing: 20) {
                    Text(club.description ?? club.summary).font(CampusFont.regular(16))
                    if let location = club.location { Label(location, systemImage: "mappin") }
                    if let schedule = club.schedule { Text(schedule) }
                    if let url = campusWebURL(club.website) { Link("Website", destination: url) }
                    if let website = model.website { Link("Open club on website", destination: website.appendingPathComponent("clubs").appendingPathComponent(club.handle)).font(CampusFont.bold(14)).foregroundStyle(palette.accent) }
                }.padding(20).frame(maxWidth: .infinity, alignment: .leading) }
            }.presentationBackground(palette.background).foregroundStyle(palette.text)
        }
    }
    private func load() async {
        guard !loading, let api = model.api else { return }; loading = true; defer { loading = false }
        do { let response: ClubsResponse = try await api.campusResource(.clubs); guard !Task.isCancelled else { return }; clubs = response.clubs; error = nil }
        catch { clubs = []; self.error = error.localizedDescription }
    }
}

func campusWebURL(_ value: String?) -> URL? {
    guard let value, let url = URL(string: value), url.scheme == "https", url.host != nil, url.user == nil, url.password == nil else { return nil }; return url
}

struct CampusDiscoveryView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.campusPalette) private var palette
    @State private var category = "Food"
    @State private var cuisine = "All"
    @State private var query = ""
    @State private var places: [NearbyPlace] = []
    @State private var listings: [CampusListing] = []
    @State private var loading = false
    @State private var error: String?
    @State private var configured = true
    @State private var requestGeneration = UUID()
    var body: some View {
        VStack(spacing: 0) {
            CampusPanelHeader(title: "Search")
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HStack { Image(systemName: "magnifyingglass"); TextField("Search \(category.lowercased())", text: $query, prompt: Text("Search \(category.lowercased())").foregroundStyle(palette.secondary)) }
                        .font(CampusFont.regular(16)).padding(18).background(palette.surface, in: Capsule())
                    HStack(spacing: 8) {
                        ForEach([("Food", "fork.knife"), ("Events", "calendar"), ("Sell", "tag")], id: \.0) { item in
                            Button { category = item.0 } label: {
                                VStack(alignment: .leading, spacing: 16) { Image(systemName: item.1).font(.system(size: 20)); Text(item.0).font(CampusFont.black(14)) }
                                    .frame(maxWidth: .infinity, alignment: .leading).padding(16).frame(height: 104)
                                    .background(category == item.0 ? palette.accentSoft : palette.surface, in: RoundedRectangle(cornerRadius: 28))
                            }.foregroundStyle(category == item.0 ? palette.accent : palette.text).accessibilityAddTraits(category == item.0 ? .isSelected : [])
                        }
                    }
                    Text("Near campus · 10 miles").font(CampusFont.regular(11, relativeTo: .caption)).foregroundStyle(palette.secondary).padding(.vertical, 12)
                    if category == "Food" {
                        ScrollView(.horizontal, showsIndicators: false) { HStack(spacing: 18) {
                            ForEach(["All", "Asian", "Fast food", "Indian", "Mexican", "Italian", "American", "Cafes"], id: \.self) { name in
                                Button { cuisine = name } label: { Text(name).font(CampusFont.regular(12)).padding(.horizontal, 12).frame(minHeight: 44).background(cuisine == name ? palette.accentSoft : .clear, in: Capsule()) }
                                    .foregroundStyle(cuisine == name ? palette.accent : palette.text).accessibilityAddTraits(cuisine == name ? .isSelected : [])
                            }
                        } }
                    }
                    if category == "Sell", let website = model.website { Link("+ Post item", destination: website).font(CampusFont.bold(14)).foregroundStyle(palette.accent).frame(minHeight: 44).accessibilityHint("Opens the website listing form") }
                    HStack { Spacer(); Button("Refresh") { Task { await load() } }.font(CampusFont.regular(12)).foregroundStyle(palette.accent).frame(minHeight: 44).disabled(loading) }
                    if loading { ProgressView().frame(maxWidth: .infinity).padding(48) }
                    else if let error { CampusFailure(message: error) { Task { await load() } } }
                    else if category == "Sell" { sellResults }
                    else { nearbyResults }
                }.padding(16)
            }.refreshable { await load() }
        }.background(palette.background).buttonStyle(CampusPressStyle()).task(id: category + ":" + cuisine) { await load() }
    }
    @ViewBuilder private var sellResults: some View {
        let visible = listings.filter { query.isEmpty || $0.title.localizedCaseInsensitiveContains(query) }
        if visible.isEmpty { empty("No items") }
        ForEach(visible) { listing in
            VStack(alignment: .leading, spacing: 12) {
                HStack { Text(listing.title).font(CampusFont.black(18)); Spacer(); Text(listing.askingPrice, format: .currency(code: "USD")).font(CampusFont.bold(16)) }
                Text([listing.brand, listing.condition == "Good" ? "Used" : listing.condition, listing.pickupArea].filter { !$0.isEmpty }.joined(separator: " · ")).font(CampusFont.regular(13)).foregroundStyle(palette.secondary)
                if let website = model.website { Link("Message seller on website", destination: website).font(CampusFont.bold(13)).foregroundStyle(palette.accent) }
            }.padding(20).background(palette.surface, in: RoundedRectangle(cornerRadius: 24))
        }
    }
    @ViewBuilder private var nearbyResults: some View {
        let visible = places.filter { query.isEmpty || $0.title.localizedCaseInsensitiveContains(query) || $0.description.localizedCaseInsensitiveContains(query) }
        if visible.isEmpty { empty(!configured && category == "Food" ? "Nearby food is coming soon" : "No \(category.lowercased()) yet") }
        ForEach(visible) { place in
            VStack(alignment: .leading, spacing: 12) {
                Text(place.title).font(CampusFont.black(18))
                if !place.description.isEmpty { Text(place.description).font(CampusFont.regular(14)).lineLimit(4) }
                Text(place.address).font(CampusFont.regular(12)).foregroundStyle(palette.secondary)
                if let date = place.startsAt.flatMap(campusDate) { Text(date, format: .dateTime.month().day().hour().minute()).font(CampusFont.bold(12)) }
                if let rating = place.rating { Label("\(rating, specifier: "%.1f") · \(place.ratingCount ?? 0)", systemImage: "star.fill").font(CampusFont.bold(12)).foregroundStyle(palette.discovery) }
                HStack {
                    if let url = campusWebURL(place.website ?? place.sourceUrl) { Link("Website", destination: url); Spacer(); ShareLink(item: url) { Label("Share", systemImage: "square.and.arrow.up") } }
                }.font(CampusFont.bold(12)).foregroundStyle(palette.accent).frame(minHeight: 44)
                Text(place.source).font(CampusFont.regular(10, relativeTo: .caption2)).foregroundStyle(palette.secondary)
            }.padding(20).background(palette.surface, in: RoundedRectangle(cornerRadius: 24))
        }
    }
    private func empty(_ text: String) -> some View { Text(text).font(CampusFont.regular(14)).foregroundStyle(palette.secondary).frame(maxWidth: .infinity).padding(.vertical, 64) }
    private func load() async {
        guard let api = model.api, let campus = campusIdentities[model.account?.account.universityId ?? ""] else { return }
        let requested = category + ":" + cuisine
        let generation = UUID(); requestGeneration = generation
        loading = true; error = nil; places = []; listings = []
        defer { if requestGeneration == generation { loading = false } }
        let origin: [URLQueryItem] = [.init(name: "lat", value: String(campus.latitude)), .init(name: "lng", value: String(campus.longitude))]
        do {
            if category == "Sell" {
                let result: MarketplaceResponse = try await api.campusResource(.marketplace, query: origin)
                guard !Task.isCancelled, requestGeneration == generation, requested == category + ":" + cuisine else { return }; listings = result.listings
            } else {
                let result: NearbyResponse = try await api.campusResource(.nearby, query: origin + [.init(name: "kind", value: category.lowercased()), .init(name: "cuisine", value: cuisine)])
                guard !Task.isCancelled, requestGeneration == generation, requested == category + ":" + cuisine else { return }; places = result.items; configured = result.configured ?? true
            }
        } catch { if !Task.isCancelled, requestGeneration == generation, requested == category + ":" + cuisine { self.error = error.localizedDescription } }
    }
}
