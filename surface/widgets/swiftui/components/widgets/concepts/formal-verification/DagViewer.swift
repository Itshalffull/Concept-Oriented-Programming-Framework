import SwiftUI

struct DagNode: Identifiable {
    let id: String
    let label: String
    var type: String?
    var status: String?
}

struct DagEdge: Identifiable {
    var id: String { "\(from)-\(to)" }
    let from: String
    let to: String
    var label: String?
}

enum DagViewerWidgetState { case idle, nodeSelected, computing }
enum DagViewerEvent {
    case selectNode(id: String?), zoom, pan, layout, deselect, layoutComplete
}

func dagViewerReduce(state: DagViewerWidgetState, event: DagViewerEvent) -> DagViewerWidgetState {
    switch state {
    case .idle:
        switch event {
        case .selectNode: return .nodeSelected
        case .layout: return .computing
        default: return .idle
        }
    case .nodeSelected:
        if case .deselect = event { return .idle }
        if case .selectNode = event { return .nodeSelected }
        return state
    case .computing:
        if case .layoutComplete = event { return .idle }
        return state
    }
}

struct DagViewerView: View {
    let nodes: [DagNode]
    let edges: [DagEdge]
    var layout: String = "dagre"
    var selectedNodeId: String?
    var onSelectNode: ((String?) -> Void)?

    @State private var widgetState: DagViewerWidgetState = .idle
    @State private var internalSelectedId: String?

    private var selectedId: String? { selectedNodeId ?? internalSelectedId }
    private var nodeMap: [String: DagNode] {
        Dictionary(uniqueKeysWithValues: nodes.map { ($0.id, $0) })
    }

    private func upstream(for id: String) -> [String] {
        edges.filter { $0.to == id }.map(\.from)
    }
    private func downstream(for id: String) -> [String] {
        edges.filter { $0.from == id }.map(\.to)
    }

    private func selectNode(_ id: String?) {
        internalSelectedId = id
        onSelectNode?(id)
        widgetState = dagViewerReduce(state: widgetState, event: id != nil ? .selectNode(id: id) : .deselect)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(nodes) { node in
                let isSelected = node.id == selectedId
                HStack(spacing: 8) {
                    Text(node.label).fontWeight(isSelected ? .bold : .regular)
                    if let t = node.type {
                        Text(t).font(.caption).padding(.horizontal, 4).background(Color.blue.opacity(0.1)).cornerRadius(3)
                    }
                    Text(node.status ?? "unknown").font(.caption).foregroundColor(.secondary)
                    Spacer()
                }
                .padding(6)
                .background(isSelected ? Color.accentColor.opacity(0.15) : Color.clear)
                .cornerRadius(6)
                .contentShape(Rectangle())
                .onTapGesture { selectNode(isSelected ? nil : node.id) }
                .accessibilityLabel("\(node.label), \(node.status ?? "unknown")")
            }

            ForEach(edges) { edge in
                HStack {
                    Text("\(nodeMap[edge.from]?.label ?? edge.from) \u{2192} \(nodeMap[edge.to]?.label ?? edge.to)")
                        .font(.caption)
                    if let l = edge.label { Text(l).font(.caption2).foregroundColor(.secondary) }
                }
            }

            if let sid = selectedId, let sel = nodeMap[sid] {
                Divider()
                VStack(alignment: .leading, spacing: 4) {
                    Text(sel.label).font(.headline)
                    if let t = sel.type { Text("Type: \(t)") }
                    Text("Status: \(sel.status ?? "unknown")")
                    Text("Upstream: \(upstream(for: sid).compactMap { nodeMap[$0]?.label }.joined(separator: ", "))")
                        .font(.caption)
                    Text("Downstream: \(downstream(for: sid).compactMap { nodeMap[$0]?.label }.joined(separator: ", "))")
                        .font(.caption)
                }
                .padding(8)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Dependency graph with \(nodes.count) nodes")
    }
}
