import SwiftUI

// State machine: open | copied | closed (no fullscreen on watch)
enum ArtifactPanelWatchState {
    case open
    case copied
    case closed
}

enum ArtifactPanelWatchEvent {
    case copy
    case copyTimeout
    case close
    case reopen
}

func artifactPanelWatchReduce(_ state: ArtifactPanelWatchState, _ event: ArtifactPanelWatchEvent) -> ArtifactPanelWatchState {
    switch state {
    case .open:
        switch event {
        case .copy: return .copied
        case .close: return .closed
        default: return state
        }
    case .copied:
        if case .copyTimeout = event { return .open }
        return state
    case .closed:
        if case .reopen = event { return .open }
        return state
    }
}

struct ArtifactPanelWatchView: View {
    let title: String
    let content: String
    var language: String? = nil
    var artifactType: String = "code" // "code", "text", "image", "html"

    @State private var state: ArtifactPanelWatchState = .open

    private var typeIcon: String {
        switch artifactType {
        case "code": return "doc.text"
        case "text": return "text.alignleft"
        case "image": return "photo"
        case "html": return "globe"
        default: return "doc"
        }
    }

    var body: some View {
        if state == .closed {
            Button {
                state = artifactPanelWatchReduce(state, .reopen)
            } label: {
                HStack {
                    Image(systemName: typeIcon).font(.caption2)
                    Text(title).font(.caption2)
                }
            }
            .buttonStyle(.bordered)
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Image(systemName: typeIcon).font(.system(size: 9)).foregroundColor(.blue)
                        Text(title).font(.caption2).fontWeight(.semibold).lineLimit(1)
                        Spacer()
                        Button {
                            state = artifactPanelWatchReduce(state, .close)
                        } label: {
                            Image(systemName: "xmark").font(.system(size: 8))
                        }
                        .buttonStyle(.plain)
                    }

                    if let lang = language {
                        Text(lang).font(.system(size: 7)).foregroundColor(.secondary)
                    }

                    Text(content)
                        .font(.system(size: 9, design: artifactType == "code" ? .monospaced : .default))
                        .padding(4)
                        .background(Color.secondary.opacity(0.08))
                        .cornerRadius(4)

                    if state == .copied {
                        Text("Copied!").font(.system(size: 8)).foregroundColor(.green)
                    }
                }
                .padding(.horizontal, 4)
            }
        }
    }
}
