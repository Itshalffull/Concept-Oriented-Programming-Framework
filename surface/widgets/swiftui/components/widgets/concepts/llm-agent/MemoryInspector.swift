import SwiftUI

// MARK: - Types

enum MemoryEntryType: String, CaseIterable { case fact, instruction, conversation, toolResult = "tool-result" }

struct MemoryEntry: Identifiable {
    let id: String
    let type: MemoryEntryType
    let content: String
    var source: String?
    var timestamp: String?
    var relevance: Double?
}

// MARK: - State Machine

enum MemoryInspectorState { case viewing, searching, entrySelected, deleting }
enum MemoryInspectorEvent {
    case switchTab, search, selectEntry(id: String), clear, deselect, delete, confirm, cancel
}

func memoryInspectorReduce(state: MemoryInspectorState, event: MemoryInspectorEvent) -> MemoryInspectorState {
    switch state {
    case .viewing:
        switch event {
        case .switchTab: return .viewing
        case .search: return .searching
        case .selectEntry: return .entrySelected
        default: return state
        }
    case .searching:
        switch event {
        case .clear: return .viewing
        case .selectEntry: return .entrySelected
        default: return state
        }
    case .entrySelected:
        switch event {
        case .deselect: return .viewing
        case .delete: return .deleting
        default: return state
        }
    case .deleting:
        switch event {
        case .confirm: return .viewing
        case .cancel: return .entrySelected
        default: return state
        }
    }
}

private let memTypeLabels: [MemoryEntryType: String] = [
    .fact: "Facts", .instruction: "Instructions", .conversation: "Conversation", .toolResult: "Tool Results"
]

// MARK: - View

struct MemoryInspectorView: View {
    let entries: [MemoryEntry]
    let totalTokens: Int
    let maxTokens: Int
    var activeTab: String = "working"
    var showContext: Bool = true
    var onDelete: ((String) -> Void)?
    var onTabChange: ((String) -> Void)?

    @State private var widgetState: MemoryInspectorState = .viewing
    @State private var searchQuery: String = ""
    @State private var selectedId: String? = nil

    private let tabs = ["working", "episodic", "semantic", "procedural"]

    private var filteredEntries: [MemoryEntry] {
        if searchQuery.trimmingCharacters(in: .whitespaces).isEmpty { return entries }
        let q = searchQuery.lowercased()
        return entries.filter { $0.content.lowercased().contains(q) || ($0.source?.lowercased().contains(q) ?? false) }
    }

    private var grouped: [(type: MemoryEntryType, items: [MemoryEntry])] {
        MemoryEntryType.allCases.compactMap { t in
            let items = filteredEntries.filter { $0.type == t }
            return items.isEmpty ? nil : (t, items)
        }
    }

    private var tokenPercent: Double {
        maxTokens > 0 ? min(Double(totalTokens) / Double(maxTokens) * 100, 100) : 0
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Tabs
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 4) {
                    ForEach(tabs, id: \.self) { tab in
                        Button(tab.capitalized) {
                            widgetState = memoryInspectorReduce(state: widgetState, event: .switchTab)
                            onTabChange?(tab)
                        }
                        .font(.system(size: 12))
                        .fontWeight(tab == activeTab ? .semibold : .regular)
                        .padding(.horizontal, 10).padding(.vertical, 4)
                        .background(tab == activeTab ? Color.blue.opacity(0.15) : Color.clear)
                        .cornerRadius(4).buttonStyle(.plain)
                    }
                }
            }.padding(.horizontal, 12).padding(.vertical, 8)

            // Search
            TextField("Search memories\u{2026}", text: $searchQuery)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal, 12).padding(.bottom, 8)
                .onChange(of: searchQuery) { val in
                    if !val.trimmingCharacters(in: .whitespaces).isEmpty {
                        if widgetState != .searching { widgetState = memoryInspectorReduce(state: widgetState, event: .search) }
                    } else {
                        if widgetState == .searching { widgetState = memoryInspectorReduce(state: widgetState, event: .clear) }
                    }
                }
                .accessibilityLabel("Search memories")

            // Token bar
            if showContext {
                VStack(spacing: 2) {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 3).fill(Color.gray.opacity(0.2))
                            RoundedRectangle(cornerRadius: 3).fill(tokenPercent > 90 ? Color.red : Color.blue)
                                .frame(width: geo.size.width * CGFloat(tokenPercent / 100))
                        }
                    }.frame(height: 8)
                    Text("\(totalTokens.formatted()) / \(maxTokens.formatted()) tokens")
                        .font(.caption2).foregroundColor(.secondary)
                }
                .padding(.horizontal, 12).padding(.bottom, 8)
                .accessibilityLabel("Context window: \(totalTokens) of \(maxTokens) tokens used")
            }

            Divider()

            // Entry list
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(grouped, id: \.type) { group in
                        HStack {
                            Text(memTypeLabels[group.type] ?? "").font(.caption).foregroundColor(.secondary)
                            Spacer()
                            Text("\(group.items.count)").font(.caption2).foregroundColor(.secondary)
                        }.padding(.horizontal, 12).padding(.vertical, 4)

                        ForEach(group.items) { entry in
                            let isSelected = selectedId == entry.id
                            VStack(alignment: .leading, spacing: 4) {
                                Text(entry.type.rawValue).font(.caption2).foregroundColor(.secondary)
                                Text(isSelected ? entry.content : String(entry.content.prefix(120)))
                                    .font(.system(size: 13)).lineLimit(isSelected ? nil : 2)
                                HStack {
                                    if let s = entry.source { Text(s).font(.caption2).foregroundColor(.secondary) }
                                    if let t = entry.timestamp { Text(t).font(.caption2).foregroundColor(.secondary) }
                                    if let r = entry.relevance { Text("\(Int(r * 100))%").font(.caption2).foregroundColor(.secondary) }
                                    Spacer()
                                    if isSelected && widgetState == .entrySelected {
                                        Button("Delete") {
                                            widgetState = memoryInspectorReduce(state: widgetState, event: .delete)
                                        }.font(.caption).foregroundColor(.red)
                                    }
                                }
                                if isSelected && widgetState == .deleting {
                                    HStack {
                                        Text("Delete this entry?").font(.caption)
                                        Button("Confirm") {
                                            onDelete?(entry.id)
                                            widgetState = memoryInspectorReduce(state: widgetState, event: .confirm)
                                            selectedId = nil
                                        }.font(.caption)
                                        Button("Cancel") {
                                            widgetState = memoryInspectorReduce(state: widgetState, event: .cancel)
                                        }.font(.caption)
                                    }
                                }
                            }
                            .padding(.horizontal, 12).padding(.vertical, 6)
                            .background(isSelected ? Color.blue.opacity(0.08) : Color.clear)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                if isSelected {
                                    selectedId = nil
                                    widgetState = memoryInspectorReduce(state: widgetState, event: .deselect)
                                } else {
                                    selectedId = entry.id
                                    widgetState = memoryInspectorReduce(state: widgetState, event: .selectEntry(id: entry.id))
                                }
                            }
                            .accessibilityLabel("\(entry.type.rawValue): \(String(entry.content.prefix(60)))")
                        }
                    }

                    if filteredEntries.isEmpty {
                        Text(searchQuery.isEmpty ? "No memory entries." : "No matching entries found.")
                            .font(.caption).foregroundColor(.secondary)
                            .padding(12)
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Memory inspector")
    }
}
