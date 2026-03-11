import SwiftUI

// State machine: idle | spanSelected
enum TraceTreeWatchState {
    case idle
    case spanSelected
}

enum TraceTreeWatchEvent {
    case selectSpan(String)
    case deselect
}

func traceTreeWatchReduce(_ state: TraceTreeWatchState, _ event: TraceTreeWatchEvent) -> TraceTreeWatchState {
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

struct TraceSpanData: Identifiable {
    let id: String
    let name: String
    let status: String // "ok", "error", "running"
    var durationMs: Int? = nil
    var children: [TraceSpanData] = []
}

struct TraceTreeWatchView: View {
    let spans: [TraceSpanData]
    var onSelectSpan: ((String) -> Void)? = nil

    @State private var state: TraceTreeWatchState = .idle
    @State private var selectedSpanId: String? = nil
    @State private var expandedIds: Set<String> = []

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "ok": return .green
        case "error": return .red
        case "running": return .blue
        default: return .secondary
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                Text("Trace").font(.caption2).fontWeight(.bold)

                ForEach(spans) { span in
                    spanRow(span, depth: 0)
                }

                if let selId = selectedSpanId, let span = findSpan(in: spans, id: selId) {
                    Divider()
                    VStack(alignment: .leading, spacing: 2) {
                        Text(span.name).font(.caption2).fontWeight(.bold)
                        Text(span.status).font(.system(size: 9)).foregroundColor(statusColor(span.status))
                        if let dur = span.durationMs {
                            Text("Duration: \(dur)ms").font(.system(size: 8)).foregroundColor(.secondary)
                        }
                        if !span.children.isEmpty {
                            Text("\(span.children.count) child spans").font(.system(size: 8)).foregroundColor(.secondary)
                        }
                    }
                }
            }
            .padding(.horizontal, 4)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Execution trace tree")
    }

    @ViewBuilder
    private func spanRow(_ span: TraceSpanData, depth: Int) -> some View {
        let hasChildren = !span.children.isEmpty
        let isExpanded = expandedIds.contains(span.id)
        let isSelected = selectedSpanId == span.id

        Button {
            if isSelected {
                selectedSpanId = nil
                state = traceTreeWatchReduce(state, .deselect)
            } else {
                selectedSpanId = span.id
                state = traceTreeWatchReduce(state, .selectSpan(span.id))
                onSelectSpan?(span.id)
            }
        } label: {
            HStack(spacing: 3) {
                if hasChildren {
                    Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                        .font(.system(size: 7)).foregroundColor(.secondary)
                        .onTapGesture {
                            if isExpanded { expandedIds.remove(span.id) }
                            else { expandedIds.insert(span.id) }
                        }
                } else {
                    Spacer().frame(width: 10)
                }
                Circle().fill(statusColor(span.status)).frame(width: 5, height: 5)
                Text(span.name).font(.caption2).lineLimit(1)
                Spacer()
                if let dur = span.durationMs {
                    Text("\(dur)ms").font(.system(size: 7)).foregroundColor(.secondary)
                }
            }
            .padding(.leading, CGFloat(depth * 10))
            .padding(.vertical, 1)
            .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
            .cornerRadius(2)
        }
        .buttonStyle(.plain)

        if hasChildren && isExpanded {
            ForEach(span.children) { child in
                spanRow(child, depth: depth + 1)
            }
        }
    }

    private func findSpan(in spans: [TraceSpanData], id: String) -> TraceSpanData? {
        for s in spans {
            if s.id == id { return s }
            if let found = findSpan(in: s.children, id: id) { return found }
        }
        return nil
    }
}
