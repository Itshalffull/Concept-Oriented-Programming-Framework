// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "ClefConcepts",
    platforms: [.macOS(.v13)],
    products: [
        .library(name: "ClefConcepts", targets: ["Clef"]),
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-crypto.git", from: "3.0.0"),
    ],
    targets: [
        .target(
            name: "Clef",
            dependencies: [
                .product(name: "Crypto", package: "swift-crypto"),
            ]
        ),
        .testTarget(
            name: "ClefTests",
            dependencies: ["Clef"]
        ),
    ]
)
