// swift-tools-version: 5.9
// Conduit Example App -- WatchKit Package Manifest

import PackageDescription

let package = Package(
    name: "ConduitWatch",
    platforms: [
        .watchOS(.v10),
    ],
    products: [
        .executable(name: "ConduitWatch", targets: ["ConduitWatch"]),
    ],
    targets: [
        .executableTarget(
            name: "ConduitWatch",
            path: ".",
            exclude: ["Package.swift"],
            sources: [
                "ConduitWatchApp.swift",
                "Views/ArticleListView.swift",
                "Views/ArticleDetailView.swift",
                "Services/WatchAPIClient.swift",
            ]
        ),
    ]
)
