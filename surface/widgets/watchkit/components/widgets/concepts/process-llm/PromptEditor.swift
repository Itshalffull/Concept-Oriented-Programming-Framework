import SwiftUI

// State machine: viewing | messageSelected (read-only on watch)
enum PromptEditorWatchState {
    case viewing
    case messageSelected
}

enum PromptEditorWatchEvent {
    case selectMessage
    case deselect
}

func promptEditorWatchReduce(_ state: PromptEditorWatchState, _ event: PromptEditorWatchEvent) -> PromptEditorWatchState {
    switch state {
    case .viewing:
        if case .selectMessage = event { return .messageSelected }
        return state
    case .messageSelected:
        if case .deselect = event { return .viewing }
        if case .selectMessage = event { return .messageSelected }
        return state
    }
}

struct PromptMessageData: Identifiable {
    let id: String
    let role: String // "system", "user", "assistant"
    let content: String
    var tokenCount: Int? = nil
}

struct PromptEditorWatchView: View {
    let messages: [PromptMessageData]
    var modelId: String? = nil
    var totalTokens: Int? = nil
    var maxTokens: Int? = nil

    @State private var state: PromptEditorWatchState = .viewing
    @State private var selectedIndex: Int? = nil

    private func roleIcon(_ role: String) -> String {
        switch role.lowercased() {
        case "system": return "gearshape"
        case "user": return "person"
        case "assistant": return "cpu"
        default: return "text.bubble"
        }
    }

    private func roleColor(_ role: String) -> Color {
        switch role.lowercased() {
        case "system": return .purple
        case "user": return .blue
        case "assistant": return .green
        default: return .secondary
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                // Header
                HStack {
                    Text("Prompt")
                        .font(.caption2)
                        .fontWeight(.bold)
                    Spacer()
                    Text("\(messages.count) messages")
                        .font(.system(size: 8))
                        .foregroundColor(.secondary)
                }

                // Model and token info
                HStack(spacing: 6) {
                    if let modelId = modelId {
                        Text(modelId)
                            .font(.system(size: 8))
                            .foregroundColor(.secondary)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(Color.secondary.opacity(0.1))
                            .cornerRadius(3)
                    }

                    if let total = totalTokens {
                        HStack(spacing: 2) {
                            Text("\(total)")
                                .font(.system(size: 8, weight: .semibold, design: .monospaced))
                            if let max = maxTokens {
                                Text("/ \(max)")
                                    .font(.system(size: 7))
                                    .foregroundColor(.secondary)
                            }
                            Text("tokens")
                                .font(.system(size: 7))
                                .foregroundColor(.secondary)
                        }
                    }
                }

                // Token usage bar
                if let total = totalTokens, let max = maxTokens, max > 0 {
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 1)
                                .fill(Color.secondary.opacity(0.2))
                                .frame(height: 2)
                            RoundedRectangle(cornerRadius: 1)
                                .fill(Double(total) / Double(max) > 0.9 ? Color.red : Color.blue)
                                .frame(
                                    width: geometry.size.width * min(CGFloat(total) / CGFloat(max), 1.0),
                                    height: 2
                                )
                        }
                    }
                    .frame(height: 2)
                }

                // Messages list
                ForEach(Array(messages.enumerated()), id: \.element.id) { index, msg in
                    Button {
                        if selectedIndex == index {
                            selectedIndex = nil
                            state = promptEditorWatchReduce(state, .deselect)
                        } else {
                            selectedIndex = index
                            state = promptEditorWatchReduce(state, .selectMessage)
                        }
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 3) {
                                Image(systemName: roleIcon(msg.role))
                                    .font(.system(size: 8))
                                    .foregroundColor(roleColor(msg.role))
                                Text(msg.role.capitalized)
                                    .font(.system(size: 8, weight: .semibold))
                                    .foregroundColor(roleColor(msg.role))
                                Spacer()
                                if let tokens = msg.tokenCount {
                                    Text("\(tokens)t")
                                        .font(.system(size: 7, design: .monospaced))
                                        .foregroundColor(.secondary)
                                }
                            }
                            Text(msg.content)
                                .font(.system(size: 9))
                                .lineLimit(selectedIndex == index ? nil : 2)
                                .foregroundColor(.primary)
                        }
                        .padding(4)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            selectedIndex == index
                                ? roleColor(msg.role).opacity(0.1)
                                : Color.secondary.opacity(0.05)
                        )
                        .cornerRadius(4)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 2)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Prompt editor, \(messages.count) messages")
    }
}
