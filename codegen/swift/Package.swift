// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "COPFConcepts",
    platforms: [.macOS(.v13)],
    products: [
        .library(name: "COPFConcepts", targets: ["COPF"]),
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-crypto.git", from: "3.0.0"),
    ],
    targets: [
        .target(
            name: "COPF",
            dependencies: [
                .product(name: "Crypto", package: "swift-crypto"),
            ]
        ),
        .testTarget(
            name: "COPFTests",
            dependencies: ["COPF"]
        ),
    ]
)
