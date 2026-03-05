import SwiftUI

// State machine: idle | nodeSelected | computing
enum DagViewerWatchState {
    case idle
    case nodeSelected
    case computing
}

enum DagViewerWatchEvent {
    case selectNode(String)
    case deselect
    case layout
    case layoutComplete
}

func dagViewerWatchReduce(_ state: DagViewerWatchState, _ event: DagViewerWatchEvent) -> DagViewerWatchState {
    switch state {
    case .idle:
        switch event {
        case .selectNode: return .nodeSelected
        case .layout: return .computing
        default: return state
        }
    case .nodeSelected:
        switch event {
        case .deselect: return .idle
        case .selectNode: return .nodeSelected
        default: return state
        }
    case .computing:
        switch event {
        case .layoutComplete: return .idle
        default: return state
        }
    }
}

struct DagViewerNode: Identifiable {
    let id: String
    let label: String
    var type: String? = nil
    var status: String? = nil
}

struct DagViewerEdge: Identifiable {
    var id: String { "\(from)-\(to)" }
    let from: String
    let to: String
    var label: String? = nil
}

struct DagViewerWatchView: View {
    let nodes: [DagViewerNode]
    let edges: [DagViewerEdge]
    var onSelectNode: ((String?) -> Void)? = nil

    @State private var state: DagViewerWatchState = .idle
    @State private var selectedNodeId: String? = nil

    private func statusIcon(_ status: String?) -> String {
        switch status {
        case "passed", "proved", "complete": return "\u{2713}"
        case "failed", "refuted": return "\u{2717}"
        case "running": return "\u{25CB}"
        default: return "\u{2022}"
        }
    }

    private func statusColor(_ status: String?) -> Color {
        switch status {
        case "passed", "proved", "complete": return .green
        case "failed", "refuted": return .red
        case "running": return .blue
        default: return .secondary
        }
    }

    private func upstream(for nodeId: String) -> [DagViewerNode] {
        let upIds = Set(edges.filter { $0.to == nodeId }.map { $0.from })
        return nodes.filter { upIds.contains($0.id) }
    }

    private func downstream(for nodeId: String) -> [DagViewerNode] {
        let downIds = Set(edges.filter { $0.from == nodeId }.map { $0.to })
        return nodes.filter { downIds.contains($0.id) }
    }

    var body: some View {
        List {
            Section {
                ForEach(nodes) { node in
                    Button {
                        if selectedNodeId == node.id {
                            selectedNodeId = nil
                            state = dagViewerWatchReduce(state, .deselect)
                            onSelectNode?(nil)
                        } else {
                            selectedNodeId = node.id
                            state = dagViewerWatchReduce(state, .selectNode(node.id))
                            onSelectNode?(node.id)
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text(statusIcon(node.status))
                                .foregroundColor(statusColor(node.status))
                                .font(.caption2)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(node.label)
                                    .font(.caption2)
                                    .fontWeight(selectedNodeId == node.id ? .bold : .regular)
                                if let type = node.type {
                                    Text(type)
                                        .font(.system(size: 9))
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                    .listRowBackground(selectedNodeId == node.id ? Color.blue.opacity(0.15) : Color.clear)
                }
            } header: {
                Text("\(nodes.count) nodes")
                    .font(.caption2)
            }

            if let selId = selectedNodeId, let node = nodes.first(where: { $0.id == selId }) {
                Section("Details") {
                    LabeledContent("Status", value: node.status ?? "unknown")
                        .font(.caption2)
                    if let type = node.type {
                        LabeledContent("Type", value: type)
                            .font(.caption2)
                    }
                    let up = upstream(for: selId)
                    if !up.isEmpty {
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Upstream (\(up.count))")
                                .font(.caption2).fontWeight(.semibold)
                            ForEach(up) { n in
                                Text(n.label).font(.system(size: 9))
                            }
                        }
                    }
                    let down = downstream(for: selId)
                    if !down.isEmpty {
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Downstream (\(down.count))")
                                .font(.caption2).fontWeight(.semibold)
                            ForEach(down) { n in
                                Text(n.label).font(.system(size: 9))
                            }
                        }
                    }
                }
            }
        }
        .listStyle(.plain)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Dependency graph with \(nodes.count) nodes")
    }
}
