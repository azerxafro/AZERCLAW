// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AzerclawApp",
    platforms: [.macOS(.v13)],
    dependencies: [
        .package(url: "https://github.com/daltoniam/Starscream.git", from: "4.0.4"),
    ],
    targets: [
        .executableTarget(
            name: "AzerclawApp",
            dependencies: ["Starscream"]
        ),
    ]
)
