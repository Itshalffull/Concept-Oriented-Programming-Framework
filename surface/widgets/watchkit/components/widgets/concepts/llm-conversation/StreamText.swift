import SwiftUI

// State machine: idle | streaming | complete | stopped
enum StreamTextWatchState {
    case idle
    case streaming
    case complete
    case stopped
}

enum StreamTextWatchEvent {
    case start
    case token
    case complete
    case stop
    case reset
}

func streamTextWatchReduce(_ state: StreamTextWatchState, _ event: StreamTextWatchEvent) -> StreamTextWatchState {
    switch state {
    case .idle:
        if case .start = event { return .streaming }
        return state
    case .streaming:
        switch event {
        case .complete: return .complete
        case .stop: return .stopped
        case .token: return .streaming
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

struct StreamTextWatchView: View {
    let content: String
    var isStreaming: Bool = false
    var tokenCount: Int? = nil
    var showCursor: Bool = true

    @State private var state: StreamTextWatchState = .idle

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            // Content with optional cursor
            HStack(alignment: .bottom, spacing: 0) {
                Text(content)
                    .font(.system(size: 10))
                if isStreaming && showCursor {
                    Text("\u{258C}")
                        .font(.system(size: 10))
                        .foregroundColor(.blue)
                        .opacity(0.8)
                }
            }

            // Status
            HStack(spacing: 6) {
                if isStreaming {
                    HStack(spacing: 3) {
                        ProgressView().scaleEffect(0.4)
                        Text("Streaming")
                            .font(.system(size: 7))
                            .foregroundColor(.blue)
                    }
                } else if state == .complete {
                    Text("Complete")
                        .font(.system(size: 7))
                        .foregroundColor(.green)
                }
                if let tokens = tokenCount {
                    Text("\(tokens) tokens")
                        .font(.system(size: 7))
                        .foregroundColor(.secondary)
                }
            }
        }
        .onAppear {
            if isStreaming {
                state = streamTextWatchReduce(state, .start)
            }
        }
        .onChange(of: isStreaming) { _, newValue in
            if !newValue && state == .streaming {
                state = streamTextWatchReduce(state, .complete)
            } else if newValue && state != .streaming {
                state = streamTextWatchReduce(state, .start)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Stream text\(isStreaming ? ", streaming" : "")")
        .accessibilityValue(content)
    }
}
