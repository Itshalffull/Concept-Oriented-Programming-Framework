import SwiftUI

// MARK: - Types

enum EntryType: String, CaseIterable { case thought, toolCall = "tool-call", toolResult = "tool-result", response, error }
enum EntryStatus: String { case running, complete, error }

struct TimelineEntry: Identifiable {
    let id: String
    let type: EntryType
    let label: String
    let timestamp: String
    var duration: Int?
    var detail: String?
    var status: EntryStatus?
}

// MARK: - State Machine

enum AgentTimelineState: String { case idle, entrySelected, interrupted, inactive, active }
enum AgentTimelineEvent {
    case newEntry
    case selectEntry(id: String)
    case interrupt
    case deselect
    case resume
    case streamStart
    case streamEnd
}

func agentTimelineReduce(state: AgentTimelineState, event: AgentTimelineEvent) -> AgentTimelineState {
    switch state {
    case .idle:
        switch event {
        case .newEntry: return .idle
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
    case .inactive:
        if case .streamStart = event { return .active }
        return state
    case .active:
        if case .streamEnd = event { return .inactive }
        return state
    }
}

// MARK: - Helpers

private let typeIcons: [EntryType: String] = [
    .thought: "\u{2022}\u{2022}\u{2022}",
    .toolCall: "\u{2699}",
    .toolResult: "\u{2611}",
    .response: "\u{25B6}",
    .error: "\u{2717}"
]

private let typeLabels: [EntryType: String] = [
    .thought: "Thought", .toolCall: "Tool Call", .toolResult: "Tool Result",
    .response: "Response", .error: "Error"
]

private func fmtDuration(_ ms: Int) -> String {
    ms < 1000 ? "\(ms)ms" : "\(String(format: "%.1f", Double(ms) / 1000))s"
}

// MARK: - View

struct AgentTimelineView: View {
    let entries: [TimelineEntry]
    let agentName: String
    let status: String
    var showDelegations: Bool = true
    var autoScroll: Bool = true
    var maxEntries: Int = 100
    var onInterrupt: (() -> Void)?

    @State private var widgetState: AgentTimelineState = .idle
    @State private var selectedEntryId: String? = nil
    @State private var expandedIds: Set<String> = []
    @State private var typeFilter: EntryType? = nil

    private var visibleEntries: [TimelineEntry] {
        let limited = Array(entries.suffix(maxEntries))
        if let f = typeFilter { return limited.filter { $0.type == f } }
        return limited
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text(agentName).font(.headline)
                HStack(spacing: 4) {
                    Circle().fill(status == "running" ? Color.green : Color.gray).frame(width: 8, height: 8)
                    Text(status).font(.caption)
                }
                Spacer()
                if status == "running" {
                    Button("Interrupt") {
                        widgetState = agentTimelineReduce(state: widgetState, event: .interrupt)
                        onInterrupt?()
                    }.font(.caption)
                }
            }.padding(.horizontal, 12).padding(.vertical, 8)

            // Filter bar
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 4) {
                    Button("All") { typeFilter = nil }
                        .font(.system(size: 12))
                        .fontWeight(typeFilter == nil ? .semibold : .regular)
                        .padding(.horizontal, 8).padding(.vertical, 2)
                        .background(typeFilter == nil ? Color.blue.opacity(0.15) : Color.clear)
                        .cornerRadius(4)
                        .buttonStyle(.plain)

                    ForEach(EntryType.allCases, id: \.self) { t in
                        Button("\(typeIcons[t] ?? "") \(typeLabels[t] ?? "")") { typeFilter = typeFilter == t ? nil : t }
                            .font(.system(size: 12))
                            .fontWeight(typeFilter == t ? .semibold : .regular)
                            .padding(.horizontal, 8).padding(.vertical, 2)
                            .background(typeFilter == t ? Color.blue.opacity(0.15) : Color.clear)
                            .cornerRadius(4)
                            .buttonStyle(.plain)
                    }
                }
            }.padding(.horizontal, 12).padding(.vertical, 6)

            Divider()

            if widgetState == .interrupted {
                HStack {
                    Text("Agent execution interrupted").font(.caption).foregroundColor(.red)
                }.padding(.horizontal, 12).padding(.vertical, 6).background(Color.red.opacity(0.08))
            }

            // Timeline entries
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(visibleEntries) { entry in
                            let isExpanded = expandedIds.contains(entry.id)
                            let isSelected = selectedEntryId == entry.id
                            let isRunning = entry.status == .running

                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: 8) {
                                    Text(typeIcons[entry.type] ?? "").font(.system(size: 14))
                                    Text(entry.label).fontWeight(.medium).lineLimit(1)
                                    if isRunning {
                                        Text("\u{25CB}").foregroundColor(.blue)
                                            .accessibilityLabel("Running")
                                    }
                                    if let d = entry.duration, entry.status != .running {
                                        Text(fmtDuration(d)).font(.caption).foregroundColor(.secondary)
                                    }
                                    Spacer()
                                    Text(entry.timestamp).font(.caption2).foregroundColor(.secondary)
                                }

                                if isExpanded, let detail = entry.detail {
                                    Text(detail).font(.system(size: 13)).padding(.leading, 24).padding(.top, 4)
                                }
                            }
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                if expandedIds.contains(entry.id) { expandedIds.remove(entry.id) }
                                else { expandedIds.insert(entry.id) }
                                selectedEntryId = entry.id
                                widgetState = agentTimelineReduce(state: widgetState, event: .selectEntry(id: entry.id))
                            }
                            .accessibilityLabel("\(typeLabels[entry.type] ?? ""): \(entry.label)")
                            .id(entry.id)
                        }
                    }
                }
                .onChange(of: entries.count) { _ in
                    if autoScroll, let last = visibleEntries.last {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Agent timeline: \(agentName)")
    }
}
