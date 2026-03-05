import SwiftUI

// MARK: - State Machine

enum InlineCitationState { case idle, previewing, navigating }
enum InlineCitationEvent { case hover, leave, navigate, close }

func inlineCitationReduce(state: InlineCitationState, event: InlineCitationEvent) -> InlineCitationState {
    switch state {
    case .idle:
        switch event {
        case .hover: return .previewing
        case .navigate: return .navigating
        default: return state
        }
    case .previewing:
        switch event {
        case .leave: return .idle
        case .navigate: return .navigating
        default: return state
        }
    case .navigating:
        if case .close = event { return .idle }
        return state
    }
}

// MARK: - View

struct InlineCitationView: View {
    let label: String
    let sourceTitle: String
    let sourceUrl: String
    var snippet: String?
    var index: Int?
    var onNavigate: (() -> Void)?

    @State private var widgetState: InlineCitationState = .idle

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: {
                widgetState = inlineCitationReduce(state: widgetState, event: .navigate)
                onNavigate?()
            }) {
                HStack(spacing: 4) {
                    if let idx = index {
                        Text("[\(idx)]").font(.system(size: 11)).foregroundColor(.blue)
                    }
                    Text(label).font(.system(size: 13)).foregroundColor(.blue).underline()
                }
            }
            .buttonStyle(.plain)
            .onHover { h in
                widgetState = h
                    ? inlineCitationReduce(state: widgetState, event: .hover)
                    : inlineCitationReduce(state: widgetState, event: .leave)
            }
            .accessibilityLabel("Citation: \(label)")

            if widgetState == .previewing {
                VStack(alignment: .leading, spacing: 4) {
                    Text(sourceTitle).font(.system(size: 12, weight: .semibold))
                    Text(sourceUrl).font(.system(size: 11)).foregroundColor(.secondary)
                    if let snip = snippet {
                        Text(snip).font(.system(size: 11)).foregroundColor(.secondary).lineLimit(3)
                    }
                }
                .padding(8)
                .background(Color(.darkGray))
                .foregroundColor(.white)
                .cornerRadius(6)
                .padding(.top, 4)
            }
        }
    }
}
