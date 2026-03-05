import SwiftUI

// State machine: idle | previewing (no hover on watch, tap to preview)
enum InlineCitationWatchState {
    case idle
    case previewing
}

enum InlineCitationWatchEvent {
    case tap
    case dismiss
    case navigate
}

func inlineCitationWatchReduce(_ state: InlineCitationWatchState, _ event: InlineCitationWatchEvent) -> InlineCitationWatchState {
    switch state {
    case .idle:
        if case .tap = event { return .previewing }
        return state
    case .previewing:
        switch event {
        case .dismiss: return .idle
        case .navigate: return .idle
        default: return state
        }
    }
}

struct InlineCitationWatchView: View {
    let index: Int
    let sourceTitle: String
    var sourceUrl: String? = nil
    var snippet: String? = nil
    var onNavigate: (() -> Void)? = nil

    @State private var state: InlineCitationWatchState = .idle

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            // Citation badge - tappable
            Button {
                if state == .previewing {
                    state = inlineCitationWatchReduce(state, .dismiss)
                } else {
                    state = inlineCitationWatchReduce(state, .tap)
                }
            } label: {
                HStack(spacing: 3) {
                    Text("[\(index)]")
                        .font(.system(size: 9, design: .monospaced))
                        .fontWeight(.bold)
                        .foregroundColor(.blue)
                    Text(sourceTitle)
                        .font(.system(size: 9))
                        .lineLimit(1)
                        .foregroundColor(.blue)
                }
            }
            .buttonStyle(.plain)

            // Preview panel
            if state == .previewing {
                VStack(alignment: .leading, spacing: 2) {
                    Text(sourceTitle)
                        .font(.caption2)
                        .fontWeight(.semibold)

                    if let snippet = snippet {
                        Text(snippet)
                            .font(.system(size: 8))
                            .foregroundColor(.secondary)
                            .lineLimit(4)
                    }

                    if let url = sourceUrl {
                        Text(url)
                            .font(.system(size: 7))
                            .foregroundColor(.blue)
                            .lineLimit(1)
                    }

                    if onNavigate != nil {
                        Button("Open") {
                            state = inlineCitationWatchReduce(state, .navigate)
                            onNavigate?()
                        }
                        .font(.caption2)
                        .buttonStyle(.bordered)
                    }
                }
                .padding(4)
                .background(Color.secondary.opacity(0.08))
                .cornerRadius(4)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Citation \(index): \(sourceTitle)")
    }
}
