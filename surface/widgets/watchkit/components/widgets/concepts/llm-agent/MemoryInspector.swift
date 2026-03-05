import SwiftUI

// State machine: viewing | entrySelected (simplified for watch - no search/delete)
enum MemoryInspectorWatchState {
    case viewing
    case entrySelected
}

enum MemoryInspectorWatchEvent {
    case selectEntry(String)
    case deselect
}

func memoryInspectorWatchReduce(_ state: MemoryInspectorWatchState, _ event: MemoryInspectorWatchEvent) -> MemoryInspectorWatchState {
    switch state {
    case .viewing:
        if case .selectEntry = event { return .entrySelected }
        return state
    case .entrySelected:
        switch event {
        case .deselect: return .viewing
        case .selectEntry: return .entrySelected
        default: return state
        }
    }
}

struct MemoryEntryData: Identifiable {
    let id: String
    let type: String // "fact", "instruction", "conversation", "tool-result"
    let content: String
    var source: String? = nil
    var timestamp: String? = nil
}

struct MemoryInspectorWatchView: View {
    let entries: [MemoryEntryData]
    var onSelectEntry: ((String) -> Void)? = nil

    @State private var state: MemoryInspectorWatchState = .viewing
    @State private var selectedEntryId: String? = nil

    private func typeIcon(_ type: String) -> String {
        switch type {
        case "fact": return "lightbulb"
        case "instruction": return "list.bullet"
        case "conversation": return "bubble.left"
        case "tool-result": return "wrench"
        default: return "doc"
        }
    }

    private func typeColor(_ type: String) -> Color {
        switch type {
        case "fact": return .yellow
        case "instruction": return .blue
        case "conversation": return .green
        case "tool-result": return .orange
        default: return .secondary
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Memory").font(.caption2).fontWeight(.bold)
                    Spacer()
                    Text("\(entries.count) entries").font(.system(size: 8)).foregroundColor(.secondary)
                }

                ForEach(entries) { entry in
                    Button {
                        if selectedEntryId == entry.id {
                            selectedEntryId = nil
                            state = memoryInspectorWatchReduce(state, .deselect)
                        } else {
                            selectedEntryId = entry.id
                            state = memoryInspectorWatchReduce(state, .selectEntry(entry.id))
                            onSelectEntry?(entry.id)
                        }
                    } label: {
                        HStack(alignment: .top, spacing: 4) {
                            Image(systemName: typeIcon(entry.type))
                                .font(.system(size: 9))
                                .foregroundColor(typeColor(entry.type))
                                .frame(width: 14)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(entry.type.replacingOccurrences(of: "-", with: " ").capitalized)
                                    .font(.system(size: 8)).fontWeight(.semibold)
                                Text(entry.content)
                                    .font(.system(size: 9))
                                    .lineLimit(selectedEntryId == entry.id ? nil : 2)
                                if selectedEntryId == entry.id {
                                    if let source = entry.source {
                                        Text("Source: \(source)").font(.system(size: 7)).foregroundColor(.secondary)
                                    }
                                    if let ts = entry.timestamp {
                                        Text(ts).font(.system(size: 7)).foregroundColor(.secondary)
                                    }
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
        .accessibilityLabel("Memory inspector with \(entries.count) entries")
    }
}
