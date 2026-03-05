import SwiftUI

// State machine: viewing | messageSelected (read-only on watch, no editing)
enum PromptTemplateEditorWatchState {
    case viewing
    case messageSelected
}

enum PromptTemplateEditorWatchEvent {
    case selectMessage
    case deselect
}

func promptTemplateEditorWatchReduce(_ state: PromptTemplateEditorWatchState, _ event: PromptTemplateEditorWatchEvent) -> PromptTemplateEditorWatchState {
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

struct TemplateMessageData: Identifiable {
    let id: String
    let role: String
    let content: String
}

struct TemplateVariableData: Identifiable {
    let id: String
    let name: String
    let type: String
    var defaultValue: String? = nil
}

struct PromptTemplateEditorWatchView: View {
    let messages: [TemplateMessageData]
    var variables: [TemplateVariableData] = []
    var modelId: String? = nil
    var showTokenCount: Bool = true
    var tokenCount: Int? = nil

    @State private var state: PromptTemplateEditorWatchState = .viewing
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
                    Text("Prompt Template")
                        .font(.caption2)
                        .fontWeight(.bold)
                    Spacer()
                    Text("\(messages.count) messages")
                        .font(.system(size: 8))
                        .foregroundColor(.secondary)
                }

                // Model badge
                if let modelId = modelId {
                    Text(modelId)
                        .font(.system(size: 8))
                        .foregroundColor(.secondary)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(Color.secondary.opacity(0.1))
                        .cornerRadius(3)
                }

                // Token count
                if showTokenCount, let tokens = tokenCount {
                    Text("\(tokens) tokens")
                        .font(.system(size: 8))
                        .foregroundColor(.secondary)
                }

                // Messages list
                ForEach(Array(messages.enumerated()), id: \.element.id) { index, msg in
                    Button {
                        if selectedIndex == index {
                            selectedIndex = nil
                            state = promptTemplateEditorWatchReduce(state, .deselect)
                        } else {
                            selectedIndex = index
                            state = promptTemplateEditorWatchReduce(state, .selectMessage)
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

                // Variables section
                if !variables.isEmpty {
                    Text("Variables")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundColor(.secondary)
                        .padding(.top, 4)

                    ForEach(variables) { variable in
                        HStack(spacing: 3) {
                            Text("{{\(variable.name)}}")
                                .font(.system(size: 8, design: .monospaced))
                                .foregroundColor(.orange)
                            Spacer()
                            Text(variable.type)
                                .font(.system(size: 7))
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
            .padding(.horizontal, 2)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Prompt template, \(messages.count) messages")
    }
}
