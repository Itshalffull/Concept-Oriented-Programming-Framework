import SwiftUI

// MARK: - State Machine

enum ArtifactPanelState { case open, copied, fullscreen, closed }
enum ArtifactPanelEvent { case copy, fullscreen, close, versionChange, copyTimeout, exitFullscreen, openPanel }

func artifactPanelReduce(state: ArtifactPanelState, event: ArtifactPanelEvent) -> ArtifactPanelState {
    switch state {
    case .open:
        switch event {
        case .copy: return .copied
        case .fullscreen: return .fullscreen
        case .close: return .closed
        case .versionChange: return .open
        default: return state
        }
    case .copied:
        if case .copyTimeout = event { return .open }
        return state
    case .fullscreen:
        switch event {
        case .exitFullscreen: return .open
        case .close: return .closed
        default: return state
        }
    case .closed:
        if case .openPanel = event { return .open }
        return state
    }
}

// MARK: - Types

enum ArtifactType: String { case code, document, image, html }

private let typeIcons: [ArtifactType: String] = [.code: "\u{1F4BB}", .document: "\u{1F4C4}", .image: "\u{1F5BC}", .html: "\u{1F310}"]
private let typeLabels: [ArtifactType: String] = [.code: "Code", .document: "Document", .image: "Image", .html: "HTML"]

// MARK: - View

struct ArtifactPanelView: View {
    let content: String
    let artifactType: ArtifactType
    let title: String
    var language: String?
    var showVersions: Bool = true
    var currentVersion: Int = 1
    var totalVersions: Int = 1
    var onVersionChange: ((Int) -> Void)?
    var onClose: (() -> Void)?
    var onCopy: (() -> Void)?

    @State private var widgetState: ArtifactPanelState = .open
    @State private var copyTimer: Timer?

    private var showVersionBar: Bool { showVersions && totalVersions > 1 }

    var body: some View {
        if widgetState == .closed { EmptyView() }
        else {
            VStack(alignment: .leading, spacing: 0) {
                // Header
                HStack(spacing: 8) {
                    Text(typeIcons[artifactType] ?? "").font(.system(size: 12))
                    Text(typeLabels[artifactType] ?? "").font(.system(size: 12))
                    Text(title).fontWeight(.semibold).lineLimit(1)
                    Spacer()

                    Button(widgetState == .copied ? "Copied!" : "Copy") { handleCopy() }
                        .font(.caption)
                    Button(widgetState == .fullscreen ? "Exit Fullscreen" : "Fullscreen") {
                        widgetState = widgetState == .fullscreen
                            ? artifactPanelReduce(state: widgetState, event: .exitFullscreen)
                            : artifactPanelReduce(state: widgetState, event: .fullscreen)
                    }.font(.caption)
                    Button("Close") {
                        widgetState = artifactPanelReduce(state: widgetState, event: .close)
                        onClose?()
                    }.font(.caption)
                }
                .padding(.horizontal, 12).padding(.vertical, 8)

                // Version bar
                if showVersionBar {
                    HStack(spacing: 8) {
                        Button("\u{2039}") { if currentVersion > 1 { onVersionChange?(currentVersion - 1) } }
                            .disabled(currentVersion <= 1)
                        Text("Version \(currentVersion) of \(totalVersions)").font(.system(size: 12))
                        Button("\u{203A}") { if currentVersion < totalVersions { onVersionChange?(currentVersion + 1) } }
                            .disabled(currentVersion >= totalVersions)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 4)
                }

                Divider()

                // Content
                ScrollView {
                    switch artifactType {
                    case .code:
                        VStack(alignment: .leading, spacing: 4) {
                            if let lang = language {
                                Text(lang.uppercased()).font(.system(size: 11)).foregroundColor(.secondary)
                            }
                            Text(content).font(.system(size: 13, design: .monospaced)).textSelection(.enabled)
                        }.padding(12)
                    case .document:
                        Text(content).font(.system(size: 14)).padding(16).textSelection(.enabled)
                    case .image:
                        // In a headless component, show the URL/path
                        Text(content).font(.system(size: 13)).foregroundColor(.secondary).padding(16)
                    case .html:
                        VStack(alignment: .leading, spacing: 8) {
                            Text("HTML preview is sandboxed.").font(.caption).foregroundColor(.secondary).italic()
                            Text(content).font(.system(size: 13, design: .monospaced)).textSelection(.enabled)
                        }.padding(12)
                    }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Artifact: \(title)")
        }
    }

    private func handleCopy() {
        #if os(macOS)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(content, forType: .string)
        #endif
        widgetState = artifactPanelReduce(state: widgetState, event: .copy)
        onCopy?()
        copyTimer?.invalidate()
        copyTimer = Timer.scheduledTimer(withTimeInterval: 2, repeats: false) { _ in
            widgetState = artifactPanelReduce(state: widgetState, event: .copyTimeout)
        }
    }
}
