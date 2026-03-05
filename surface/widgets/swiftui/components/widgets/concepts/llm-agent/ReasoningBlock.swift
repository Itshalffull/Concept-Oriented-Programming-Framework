import SwiftUI

// MARK: - State Machine

enum ReasoningBlockState { case collapsed, expanded, streaming }
enum ReasoningBlockEvent { case expand, collapse, toggle, streamStart, token, streamEnd }

func reasoningBlockReduce(state: ReasoningBlockState, event: ReasoningBlockEvent) -> ReasoningBlockState {
    switch state {
    case .collapsed:
        switch event {
        case .expand, .toggle: return .expanded
        case .streamStart: return .streaming
        default: return state
        }
    case .expanded:
        switch event {
        case .collapse, .toggle: return .collapsed
        default: return state
        }
    case .streaming:
        switch event {
        case .token: return .streaming
        case .streamEnd: return .collapsed
        default: return state
        }
    }
}

// MARK: - View

struct ReasoningBlockView: View {
    let content: String
    var collapsed: Bool = true
    var onToggle: (() -> Void)?
    var defaultExpanded: Bool = false
    var showDuration: Bool = true
    var streaming: Bool = false
    var duration: Int?

    @State private var widgetState: ReasoningBlockState = .collapsed

    private var isBodyVisible: Bool { widgetState == .expanded || widgetState == .streaming }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            Button(action: handleToggle) {
                HStack(spacing: 8) {
                    Text("\u{1F9E0}").font(.system(size: 16))
                    Text(widgetState == .streaming ? "Thinking..." : "Reasoning")
                        .font(.system(size: 14, weight: .medium))
                    if showDuration && widgetState != .streaming, let d = duration {
                        Text("\(d)ms").font(.caption).foregroundColor(.secondary)
                    }
                    Spacer()
                    Text(isBodyVisible ? "\u{25BC}" : "\u{25B6}").font(.system(size: 10)).foregroundColor(.secondary)
                }
                .padding(.horizontal, 12).padding(.vertical, 8)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Toggle reasoning details")

            if isBodyVisible {
                Text(content)
                    .font(.system(size: 13))
                    .padding(.horizontal, 12).padding(.bottom, 12)
                    .accessibilityLabel("Reasoning content")
            }
        }
        .onAppear {
            widgetState = streaming ? .streaming : (defaultExpanded ? .expanded : .collapsed)
        }
        .onChange(of: streaming) { s in
            if s && widgetState != .streaming {
                widgetState = reasoningBlockReduce(state: widgetState, event: .streamStart)
            }
            if !s && widgetState == .streaming {
                widgetState = reasoningBlockReduce(state: widgetState, event: .streamEnd)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Model reasoning")
    }

    private func handleToggle() {
        guard widgetState != .streaming else { return }
        widgetState = reasoningBlockReduce(state: widgetState, event: .toggle)
        onToggle?()
    }
}
