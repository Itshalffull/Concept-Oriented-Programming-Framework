import SwiftUI

// State machine: idle | entrySelected | interrupted
enum AgentTimelineWatchState {
    case idle
    case entrySelected
    case interrupted
}

enum AgentTimelineWatchEvent {
    case selectEntry(String)
    case interrupt
    case deselect
    case resume
}

func agentTimelineWatchReduce(_ state: AgentTimelineWatchState, _ event: AgentTimelineWatchEvent) -> AgentTimelineWatchState {
    switch state {
    case .idle:
        switch event {
        case .selectEntry: return .entrySelected
        case .interrupt: return .interrupted
        default: return state
        }
    case .entrySelected:
        switch event {
        case .deselect: return .idle
        case .selectEntry: return .entrySelected
        default: return state
        }
    case .interrupted:
        if case .resume = event { return .idle }
        return state
    }
}

struct TimelineEntryData: Identifiable {
    let id: String
    let type: String // "thought", "tool-call", "tool-result", "response", "error"
    let content: String
    var status: String = "complete" // "running", "complete", "error"
    var timestamp: String? = nil
}

struct AgentTimelineWatchView: View {
    let entries: [TimelineEntryData]
    var agentStatus: String = "idle"
    var onEntrySelect: ((String) -> Void)? = nil

    @State private var state: AgentTimelineWatchState = .idle
    @State private var selectedEntryId: String? = nil

    private func typeIcon(_ type: String) -> String {
        switch type {
        case "thought": return "brain"
        case "tool-call": return "wrench"
        case "tool-result": return "arrow.down.doc"
        case "response": return "text.bubble"
        case "error": return "exclamationmark.triangle"
        default: return "circle"
        }
    }

    private func typeColor(_ type: String) -> Color {
        switch type {
        case "thought": return .purple
        case "tool-call": return .blue
        case "tool-result": return .cyan
        case "response": return .green
        case "error": return .red
        default: return .secondary
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Agent").font(.caption2).fontWeight(.bold)
                    Spacer()
                    Text(agentStatus)
                        .font(.system(size: 8))
                        .foregroundColor(agentStatus == "active" ? .green : .secondary)
                }

                ForEach(entries) { entry in
                    Button {
                        if selectedEntryId == entry.id {
                            selectedEntryId = nil
                            state = agentTimelineWatchReduce(state, .deselect)
                        } else {
                            selectedEntryId = entry.id
                            state = agentTimelineWatchReduce(state, .selectEntry(entry.id))
                            onEntrySelect?(entry.id)
                        }
                    } label: {
                        HStack(alignment: .top, spacing: 4) {
                            Image(systemName: typeIcon(entry.type))
                                .font(.system(size: 9))
                                .foregroundColor(typeColor(entry.type))
                                .frame(width: 14)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(entry.type.replacingOccurrences(of: "-", with: " "))
                                    .font(.system(size: 8)).fontWeight(.semibold)
                                    .foregroundColor(typeColor(entry.type))
                                Text(entry.content)
                                    .font(.system(size: 9))
                                    .lineLimit(selectedEntryId == entry.id ? nil : 2)
                                if entry.status == "running" {
                                    ProgressView().scaleEffect(0.5)
                                }
                            }
                        }
                        .padding(.vertical, 2)
                        .background(selectedEntryId == entry.id ? Color.blue.opacity(0.1) : Color.clear)
                        .cornerRadius(3)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 4)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Agent timeline with \(entries.count) entries")
    }
}
