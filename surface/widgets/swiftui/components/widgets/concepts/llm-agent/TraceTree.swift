import SwiftUI

// MARK: - Types

struct TraceSpan: Identifiable {
    let id: String
    let type: String
    let label: String
    let duration: Int
    var tokens: Int?
    let status: String
    var children: [TraceSpan]?
}

// MARK: - State Machine

enum TraceTreeState { case idle, spanSelected }
enum TraceTreeEvent {
    case selectSpan(id: String), deselect, expand(id: String), collapse(id: String), filter(spanType: String)
}

func traceTreeReduce(state: TraceTreeState, event: TraceTreeEvent) -> TraceTreeState {
    switch state {
    case .idle:
        if case .selectSpan = event { return .spanSelected }
        return state
    case .spanSelected:
        switch event {
        case .deselect: return .idle
        case .selectSpan: return .spanSelected
        default: return state
        }
    }
}

private let spanTypeLabels: [String: String] = ["llm": "LLM", "tool": "Tool", "chain": "Chain", "agent": "Agent"]
private let spanTypeIcons: [String: String] = ["llm": "\u{1F9E0}", "tool": "\u{2699}", "chain": "\u{1F517}", "agent": "\u{1F916}"]
private let spanStatusIcons: [String: String] = ["success": "\u{2713}", "running": "\u{25CB}", "error": "\u{2717}", "pending": "\u{2022}"]

private func findSpan(_ spans: [TraceSpan], id: String) -> TraceSpan? {
    for s in spans {
        if s.id == id { return s }
        if let c = s.children, let f = findSpan(c, id: id) { return f }
    }
    return nil
}

// MARK: - View

struct TraceTreeView: View {
    let spans: [TraceSpan]
    let rootLabel: String
    var totalDuration: Int?
    var totalTokens: Int?
    var onSelectSpan: ((String?) -> Void)?
    var showMetrics: Bool = true

    @State private var widgetState: TraceTreeState = .idle
    @State private var selectedId: String? = nil
    @State private var expandedIds: Set<String> = []
    @State private var visibleTypes: Set<String> = ["llm", "tool", "chain", "agent"]

    private var selectedSpan: TraceSpan? {
        guard let sid = selectedId else { return nil }
        return findSpan(spans, id: sid)
    }

    private var availableTypes: [String] {
        var types: Set<String> = []
        func walk(_ nodes: [TraceSpan]) { for s in nodes { types.insert(s.type); if let c = s.children { walk(c) } } }
        walk(spans); return Array(types).sorted()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text(rootLabel).font(.headline)
                Spacer()
                if showMetrics, let d = totalDuration { Text("\(d)ms").font(.caption).foregroundColor(.secondary) }
                if showMetrics, let t = totalTokens { Text("\(t) tokens").font(.caption).foregroundColor(.secondary) }
            }.padding(.horizontal, 12).padding(.vertical, 8)

            // Filter bar
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 4) {
                    ForEach(availableTypes, id: \.self) { t in
                        Button("\(spanTypeLabels[t] ?? t)") {
                            if visibleTypes.contains(t) { visibleTypes.remove(t) } else { visibleTypes.insert(t) }
                        }
                        .font(.system(size: 12))
                        .fontWeight(visibleTypes.contains(t) ? .semibold : .regular)
                        .padding(.horizontal, 8).padding(.vertical, 2)
                        .background(visibleTypes.contains(t) ? Color.blue.opacity(0.15) : Color.clear)
                        .cornerRadius(4).buttonStyle(.plain)
                    }
                }
            }.padding(.horizontal, 12).padding(.bottom, 6)

            Divider()

            HStack(alignment: .top, spacing: 0) {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(spans.filter { visibleTypes.contains($0.type) }) { span in
                            spanNode(span, depth: 0)
                        }
                    }
                }

                if widgetState == .spanSelected, let span = selectedSpan {
                    Divider()
                    detailPanel(span).frame(width: 240)
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Execution trace")
    }

    @ViewBuilder
    private func spanNode(_ span: TraceSpan, depth: Int) -> some View {
        let isExpanded = expandedIds.contains(span.id)
        let isSelected = selectedId == span.id
        let hasChildren = !(span.children ?? []).isEmpty
        let visibleChildren = (span.children ?? []).filter { visibleTypes.contains($0.type) }

        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                if hasChildren {
                    Button(action: { toggleExpand(span.id) }) {
                        Text(isExpanded ? "\u{25BC}" : "\u{25B6}").font(.system(size: 10))
                    }.buttonStyle(.plain)
                }
                Text(spanTypeIcons[span.type] ?? "\u{25CF}").font(.system(size: 12))
                Text(span.label).lineLimit(1)
                Text("\(span.duration)ms").font(.caption).foregroundColor(.secondary)
                if showMetrics, let t = span.tokens { Text("\(t) tok").font(.caption2).foregroundColor(.secondary) }
                Spacer()
                Text(spanStatusIcons[span.status] ?? "\u{2022}")
                    .foregroundColor(span.status == "error" ? .red : .primary)
            }
            .padding(.leading, CGFloat(depth * 16))
            .padding(.horizontal, 8).padding(.vertical, 5)
            .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
            .contentShape(Rectangle())
            .onTapGesture { selectSpan(span.id) }
            .accessibilityLabel("\(span.type): \(span.label) (\(span.duration)ms)")

            if hasChildren && isExpanded {
                ForEach(visibleChildren) { child in spanNode(child, depth: depth + 1) }
            }
        }
    }

    @ViewBuilder
    private func detailPanel(_ span: TraceSpan) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("\(spanTypeIcons[span.type] ?? "") \(spanTypeLabels[span.type] ?? span.type)").font(.caption).foregroundColor(.secondary)
                Spacer()
                Button(action: { deselectSpan() }) { Text("\u{2715}") }.buttonStyle(.plain)
            }
            Group {
                labelValue("Label", span.label)
                labelValue("Status", "\(spanStatusIcons[span.status] ?? "") \(span.status)")
                labelValue("Duration", "\(span.duration)ms")
                if let t = span.tokens { labelValue("Tokens", "\(t)") }
                if let c = span.children, !c.isEmpty { labelValue("Children", "\(c.count) spans") }
            }
            Spacer()
        }.padding()
    }

    @ViewBuilder
    private func labelValue(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption).foregroundColor(.secondary)
            Text(value).font(.system(size: 13))
        }
    }

    private func selectSpan(_ id: String) {
        if selectedId == id { deselectSpan(); return }
        selectedId = id
        widgetState = traceTreeReduce(state: widgetState, event: .selectSpan(id: id))
        onSelectSpan?(id)
    }

    private func deselectSpan() {
        selectedId = nil
        widgetState = traceTreeReduce(state: widgetState, event: .deselect)
        onSelectSpan?(nil)
    }

    private func toggleExpand(_ id: String) {
        if expandedIds.contains(id) { expandedIds.remove(id) } else { expandedIds.insert(id) }
    }
}
