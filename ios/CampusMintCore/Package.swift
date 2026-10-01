// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "CampusMintCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "CampusMintCore", targets: ["CampusMintCore"])],
    targets: [
        .target(name: "CampusMintCore"),
        // A dependency-free check runner also works with Apple's command-line-only Swift installation.
        .executableTarget(name: "CampusMintCoreChecks", dependencies: ["CampusMintCore"], path: "Tests/CampusMintCoreTests"),
    ]
)
