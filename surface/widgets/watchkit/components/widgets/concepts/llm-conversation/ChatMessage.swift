import SwiftUI

// State machine: idle | streaming | copied (no hover on watch)
enum ChatMessageWatchState {
    case idle
    case streaming
    case copied
}

enum ChatMessageWatchEvent {
    case copy
    case copyTimeout
    case streamStart
    case streamEnd
}

func chatMessageWatchReduce(_ state: ChatMessageWatchState, _ event: ChatMessageWatchEvent) -> ChatMessageWatchState {
    switch state {
    case .idle:
        switch event {
        case .copy: return .copied
        case .streamStart: return .streaming
        default: return state
        }
    case .streaming:
        if case .streamEnd = event { return .idle }
        return state
    case .copied:
        if case .copyTimeout = event { return .idle }
        return state
    }
}

struct ChatMessageWatchView: View {
    let role: String // "user", "assistant", "system"
    let content: String
    var isStreaming: Bool = false
    var timestamp: String? = nil
    var model: String? = nil

    @State private var state: ChatMessageWatchState = .idle

    private var roleIcon: String {
        switch role {
        case "user": return "person.fill"
        case "assistant": return "cpu"
        case "system": return "gearshape"
        default: return "bubble.left"
        }
    }

    private var roleColor: Color {
        switch role {
        case "user": return .blue
        case "assistant": return .green
        case "system": return .orange
        default: return .secondary
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            // Role header
            HStack(spacing: 4) {
                Image(systemName: roleIcon)
                    .font(.system(size: 9))
                    .foregroundColor(roleColor)
                Text(role.capitalized)
                    .font(.system(size: 8))
                    .fontWeight(.semibold)
                    .foregroundColor(roleColor)
                Spacer()
                if isStreaming {
                    ProgressView().scaleEffect(0.4)
                }
            }

            // Content
            Text(content)
                .font(.system(size: 9))

            // Metadata
            HStack(spacing: 6) {
                if let model = model {
                    Text(model)
                        .font(.system(size: 7))
                        .foregroundColor(.secondary)
                }
                if let ts = timestamp {
                    Text(ts)
                        .font(.system(size: 7))
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.vertical, 2)
        .onAppear {
            if isStreaming {
                state = chatMessageWatchReduce(state, .streamStart)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(role) message: \(content)")
    }
}
