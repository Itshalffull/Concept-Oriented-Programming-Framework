// swift-tools-version: 5.9
// Conduit Example App -- AppKit/macOS Package Manifest

import PackageDescription

let package = Package(
    name: "ConduitMac",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .executable(name: "ConduitMac", targets: ["ConduitMac"]),
    ],
    targets: [
        .executableTarget(
            name: "ConduitMac",
            path: ".",
            exclude: ["Package.swift"],
            sources: [
                "AppDelegate.swift",
                "MainWindow.swift",
                "Views/ArticleListView.swift",
                "Views/ArticleDetailView.swift",
                "Views/LoginView.swift",
                "Services/APIClient.swift",
            ]
        ),
    ]
)
