import SwiftUI

/// Values and contrast adjustment mirror data/appearance.ts in the web product.
struct CampusRGB {
    let r: Double; let g: Double; let b: Double
    init(_ hex: Int) { r = Double((hex >> 16) & 255); g = Double((hex >> 8) & 255); b = Double(hex & 255) }
    init(r: Double, g: Double, b: Double) { self.r = r; self.g = g; self.b = b }
    var color: Color { Color(red: r / 255, green: g / 255, blue: b / 255) }
    func mix(_ background: CampusRGB, weight: Double) -> CampusRGB {
        CampusRGB(r: (r * weight + background.r * (1-weight)).rounded(), g: (g * weight + background.g * (1-weight)).rounded(), b: (b * weight + background.b * (1-weight)).rounded())
    }
    var luminance: Double {
        func linear(_ channel: Double) -> Double { let v = channel / 255; return v <= 0.04045 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4) }
        return linear(r) * 0.2126 + linear(g) * 0.7152 + linear(b) * 0.0722
    }
    func contrast(_ other: CampusRGB) -> Double { (max(luminance, other.luminance) + 0.05) / (min(luminance, other.luminance) + 0.05) }
}

enum CampusAccent: String, CaseIterable, Identifiable {
    case campus, brand, slate, warmGray, forest, deepNavy, mutedMaroon
    var id: String { rawValue }
    var label: String { switch self {
    case .campus: "School"; case .brand: "Campus Mint"; case .slate: "Slate"
    case .warmGray: "Warm Gray"; case .forest: "Forest"; case .deepNavy: "Deep Navy"; case .mutedMaroon: "Muted Maroon"
    } }
    func rgb(dark: Bool, school: Int) -> CampusRGB { let value = switch self {
    case .campus: school; case .brand: dark ? 0xd37a8c : 0x6f1d2c
    case .slate: 0x526074; case .warmGray: 0x716963; case .forest: 0x315c49
    case .deepNavy: 0x23395b; case .mutedMaroon: 0x744052
    }; return CampusRGB(value) }
}

struct CampusPalette {
    let background: Color; let surface: Color; let raised: Color
    let text: Color; let secondary: Color
    let accent: Color; let accentSoft: Color; let accentContrast: Color
    let urgent: Color; let discovery: Color; let personal: Color
    static func resolve(_ appearance: Appearance, system: ColorScheme, selection: CampusAccent, school: Int) -> CampusPalette {
        let dark = appearance == .dark || (appearance == .colorful && system == .dark)
        let background = CampusRGB(dark ? 0x0a0a0a : 0xfafafa)
        let raised = CampusRGB(dark ? 0x242424 : 0xf0f0f0)
        func semantic(_ input: CampusRGB) -> (Color, Color, Color) {
            var fg = input
            for _ in 0..<8 { if fg.contrast(raised) >= 4.5 { break }; fg = fg.mix(CampusRGB(dark ? 0xffffff : 0), weight: 0.82) }
            var weight = dark ? 0.22 : 0.1
            var soft = fg.mix(background, weight: weight)
            while fg.contrast(soft) < 4.5 && weight > 0.02 { weight -= 0.02; soft = fg.mix(background, weight: weight) }
            return (fg.color, soft.color, CampusRGB(fg.contrast(CampusRGB(0x111111)) >= fg.contrast(CampusRGB(0xffffff)) ? 0x111111 : 0xffffff).color)
        }
        let colorful = appearance == .colorful
        let configured = colorful ? CampusRGB(dark ? 0x79c39d : 0x287650) : selection.rgb(dark: dark, school: school)
        let accent = semantic(configured)
        return CampusPalette(background: background.color, surface: CampusRGB(dark ? 0x141414 : 0xffffff).color, raised: raised.color,
            text: CampusRGB(dark ? 0xfafafa : 0x171717).color, secondary: CampusRGB(dark ? 0xbcbcbc : 0x595959).color,
            accent: accent.0, accentSoft: accent.1, accentContrast: accent.2,
            urgent: semantic(colorful ? CampusRGB(dark ? 0xee9697 : 0xb74346) : configured).0,
            discovery: semantic(colorful ? CampusRGB(dark ? 0xe8ad78 : 0xa85a20) : configured).0, personal: accent.0)
    }
}
private struct CampusPaletteKey: EnvironmentKey {
    static let defaultValue = CampusPalette.resolve(.light, system: .light, selection: .campus, school: 0x500000)
}
extension EnvironmentValues {
    var campusPalette: CampusPalette { get { self[CampusPaletteKey.self] } set { self[CampusPaletteKey.self] = newValue } }
}

enum CampusFont {
    static func regular(_ size: CGFloat, relativeTo style: Font.TextStyle = .body) -> Font { .custom("Geist-Regular", size: size, relativeTo: style) }
    static func bold(_ size: CGFloat, relativeTo style: Font.TextStyle = .headline) -> Font { .custom("Geist-Bold", size: size, relativeTo: style) }
    static func black(_ size: CGFloat, relativeTo style: Font.TextStyle = .headline) -> Font { .custom("Geist-Black", size: size, relativeTo: style) }
}

/// The same three paths as the website's MintBackLeafIcon, scaled from its 32pt view box.
struct CampusLeaf: View {
    var back = false
    var body: some View {
        Canvas { context, size in
            context.scaleBy(x: size.width / 32, y: size.height / 32)
            var outline = Path()
            outline.move(to: CGPoint(x: 25.8, y: 5.5))
            outline.addCurve(to: CGPoint(x: 7, y: 18.1), control1: CGPoint(x: 17, y: 5.8), control2: CGPoint(x: 8.6, y: 9.9))
            outline.addCurve(to: CGPoint(x: 13.8, y: 24.5), control1: CGPoint(x: 6.2, y: 22.4), control2: CGPoint(x: 9.6, y: 25.8))
            outline.addCurve(to: CGPoint(x: 25.8, y: 5.5), control1: CGPoint(x: 21.6, y: 22.1), control2: CGPoint(x: 24.5, y: 13.9))
            outline.closeSubpath()
            context.stroke(outline, with: .foreground, style: StrokeStyle(lineWidth: 2.4, lineCap: .round, lineJoin: .round))
            var stem = Path(); stem.move(to: CGPoint(x: 8.6, y: 24.8))
            stem.addCurve(to: CGPoint(x: 22.4, y: 11.6), control1: CGPoint(x: 11.4, y: 18.6), control2: CGPoint(x: 15.8, y: 14.7))
            context.stroke(stem, with: .foreground, style: StrokeStyle(lineWidth: 2, lineCap: .round))
            var veins = Path(); veins.move(to: CGPoint(x: 13.4, y: 18.7))
            veins.addCurve(to: CGPoint(x: 18.6, y: 19.9), control1: CGPoint(x: 15.3, y: 18.8), control2: CGPoint(x: 17.1, y: 19.2))
            veins.move(to: CGPoint(x: 16.7, y: 14.5))
            veins.addCurve(to: CGPoint(x: 16.2, y: 10.5), control1: CGPoint(x: 16.8, y: 13), control2: CGPoint(x: 16.6, y: 11.7))
            context.opacity = 0.82
            context.stroke(veins, with: .foreground, style: StrokeStyle(lineWidth: 1.45, lineCap: .round))
        }.rotationEffect(.degrees(back ? -135 : 0)).accessibilityHidden(true)
    }
}

struct CampusPressStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reducedMotion
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.opacity(configuration.isPressed ? 0.7 : 1)
            .scaleEffect(configuration.isPressed && !reducedMotion ? 0.98 : 1)
            .animation(reducedMotion ? nil : .easeOut(duration: 0.16), value: configuration.isPressed)
    }
}

let campusAccentColors: [String: Int] = [
    "tamu": 0x500000,
    "blinn": 0x003366,
    "texas": 0xBF5700,
    "lsu": 0x35145F,
    "alabama": 0x7A1426,
    "oregon": 0x007030,
    "harvard": 0xA51C30,
    "michigan": 0x00274C,
    "miami": 0x005030,
    "ucla": 0x2774AE,
    "stanford": 0x8C1515,
    "usc": 0x990000,
    "washington": 0x4B2E83,
    "ohio-state": 0xBA0C2F,
    "penn-state": 0x001E44,
    "duke": 0x012169,
    "uconn": 0x000E2F,
    "wisconsin": 0xC5050C,
    "mines": 0x21314D,
    "williams": 0x500082,
]

struct CampusIdentity { let name: String; let latitude: Double; let longitude: Double }
let campusIdentities: [String: CampusIdentity] = [
    "tamu": CampusIdentity(name: "Texas A&M", latitude: 30.6187, longitude: -96.3365),
    "blinn": CampusIdentity(name: "Blinn", latitude: 30.6601, longitude: -96.3908),
    "texas": CampusIdentity(name: "Texas", latitude: 30.2849, longitude: -97.7341),
    "lsu": CampusIdentity(name: "LSU", latitude: 30.412, longitude: -91.1838),
    "alabama": CampusIdentity(name: "Alabama", latitude: 33.214, longitude: -87.5391),
    "oregon": CampusIdentity(name: "Oregon", latitude: 44.0448, longitude: -123.0726),
    "harvard": CampusIdentity(name: "Harvard", latitude: 42.377, longitude: -71.1167),
    "michigan": CampusIdentity(name: "Michigan", latitude: 42.278, longitude: -83.7382),
    "miami": CampusIdentity(name: "Miami", latitude: 25.7174, longitude: -80.2789),
    "ucla": CampusIdentity(name: "UCLA", latitude: 34.0689, longitude: -118.4452),
    "stanford": CampusIdentity(name: "Stanford", latitude: 37.4275, longitude: -122.1697),
    "usc": CampusIdentity(name: "USC", latitude: 34.0224, longitude: -118.2851),
    "washington": CampusIdentity(name: "Washington", latitude: 47.6553, longitude: -122.3035),
    "ohio-state": CampusIdentity(name: "Ohio State", latitude: 40.0067, longitude: -83.0305),
    "penn-state": CampusIdentity(name: "Penn State", latitude: 40.7982, longitude: -77.8599),
    "duke": CampusIdentity(name: "Duke", latitude: 36.0014, longitude: -78.9382),
    "uconn": CampusIdentity(name: "UConn", latitude: 41.8077, longitude: -72.2540),
    "wisconsin": CampusIdentity(name: "Wisconsin", latitude: 43.0766, longitude: -89.4125),
    "mines": CampusIdentity(name: "Colorado Mines", latitude: 39.7512, longitude: -105.2226),
    "williams": CampusIdentity(name: "Williams", latitude: 42.7128, longitude: -73.2030)
]

struct CampusAvatar: View {
    @Environment(\.campusPalette) private var palette
    let name: String
    var size: CGFloat = 40
    var body: some View {
        Text(name.split(separator: " ").prefix(2).compactMap { $0.first }.map(String.init).joined().uppercased())
            .font(CampusFont.black(size * 0.32)).foregroundStyle(palette.secondary)
            .frame(width: size, height: size).background(palette.raised, in: Circle())
            .accessibilityHidden(true)
    }
}
struct CampusIconButton: View {
    let icon: String; let label: String; let action: () -> Void
    var body: some View {
        Button(action: action) { Image(systemName: icon).font(.system(size: 20, weight: .regular)).frame(width: 44, height: 44).contentShape(Rectangle()) }
            .accessibilityLabel(label)
    }
}
struct CampusFailure: View {
    @Environment(\.campusPalette) private var palette
    let message: String; let retry: () -> Void
    var body: some View {
        VStack(spacing: 12) { Text(message).font(CampusFont.regular(14)).multilineTextAlignment(.center).foregroundStyle(palette.secondary)
            Button("Try again", action: retry).font(CampusFont.bold(14)).foregroundStyle(palette.accent).frame(minHeight: 44)
        }.frame(maxWidth: .infinity).padding(24)
    }
}
