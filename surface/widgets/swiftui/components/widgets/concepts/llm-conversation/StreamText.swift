import SwiftUI

// MARK: - State Machine

enum StreamTextState { case idle, streaming, complete, stopped }
enum StreamTextEvent { case streamStart, token, streamEnd, stop, reset }

func streamTextReduce(state: StreamTextState, event: StreamTextEvent) -> StreamTextState {
    switch state {
    case .idle:
        if case .streamStart = event { return .streaming }
        return state
    case .streaming:
        switch event {
        case .token: return .streaming
        case .streamEnd: return .complete
        case .stop: return .stopped
        default: return state
        }
    case .complete:
        if case .reset = event { return .idle }
        return state
    case .stopped:
        if case .reset = event { return .idle }
        return state
    }
}

// MARK: - View

struct StreamTextView: View {
    let content: String
    var isStreaming: Bool = false
    var showCursor: Bool = true
    var speed: String = "normal"
    var onStop: (() -> Void)?
    var onComplete: (() -> Void)?

    @State private var widgetState: StreamTextState = .idle

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .bottom, spacing: 0) {
                Text(content).font(.system(size: 14)).textSelection(.enabled)

                if widgetState == .streaming && showCursor {
                    Rectangle().fill(Color.primary).frame(width: 2, height: 16).opacity(0.7)
                }
            }

            if widgetState == .streaming {
                Button("Stop") {
                    widgetState = streamTextReduce(state: widgetState, event: .stop)
                    onStop?()
                }.font(.caption).accessibilityLabel("Stop streaming")
            }

            if widgetState == .complete {
                Text("Complete").font(.caption2).foregroundColor(.green)
            }
        }
        .onAppear {
            if isStreaming { widgetState = streamTextReduce(state: widgetState, event: .streamStart) }
        }
        .onChange(of: isStreaming) { s in
            if s && widgetState == .idle {
                widgetState = streamTextReduce(state: widgetState, event: .streamStart)
            } else if !s && widgetState == .streaming {
                widgetState = streamTextReduce(state: widgetState, event: .streamEnd)
                onComplete?()
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Streaming text")
    }
}
