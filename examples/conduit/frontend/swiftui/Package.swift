// swift-tools-version: 5.9
// Conduit Example App -- SwiftUI Package Manifest

import PackageDescription

let package = Package(
    name: "ConduitSwiftUI",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        .executable(name: "Conduit", targets: ["Conduit"]),
    ],
    targets: [
        .executableTarget(
            name: "Conduit",
            path: ".",
            exclude: ["Package.swift"],
            sources: [
                "ConduitApp.swift",
                "Views/HomeView.swift",
                "Views/LoginView.swift",
                "Views/ArticleView.swift",
                "Views/ProfileView.swift",
                "Models/Article.swift",
                "Models/User.swift",
                "Services/APIService.swift",
            ]
        ),
    ]
)
