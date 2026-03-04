// ============================================================
// Clef Surface SwiftUI Widget — WorkflowEditor
//
// Node-graph workflow canvas rendered as a VStack with a list
// of nodes and their connections. Supports node selection,
// adding/removing nodes, and displays connections between
// nodes as indented sub-items.
// ============================================================

import SwiftUI

struct WorkflowEditorNode: Identifiable {
    let id: String
    let type: String
    let label: String
}

struct WorkflowConnection: Identifiable {
    var id: String { "\(from)->\(to)" }
    let from: String
    let to: String
}

struct WorkflowEditorView: View {
    var nodes: [WorkflowEditorNode]
    var connections: [WorkflowConnection]
    var selectedNode: String? = nil
    var onSelectNode: (String) -> Void = { _ in }
    var onAddNode: () -> Void = {}
    var onRemoveNode: (String) -> Void = { _ in }

    var body: some View {
        let adjacency: [String: [String]] = {
            var adj = [String: [String]]()
            for conn in connections {
                adj[conn.from, default: []].append(conn.to)
            }
            return adj
        }()
        let nodeLabels = Dictionary(uniqueKeysWithValues: nodes.map { ($0.id, $0.label) })

        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Workflow")
                    .font(.headline)
                    .fontWeight(.bold)
                Text("(\(nodes.count) nodes, \(connections.count) connections)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            ScrollView {
                LazyVStack(spacing: 4) {
                    ForEach(nodes) { node in
                        let isSelected = node.id == selectedNode
                        let targets = adjacency[node.id] ?? []

                        SwiftUI.Button(action: { onSelectNode(node.id) }) {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: 8) {
                                    Text("[\(node.type)]")
                                        .font(.caption)
                                        .foregroundColor(.secondary)

                                    Text(node.label)
                                        .font(.subheadline)
                                        .fontWeight(isSelected ? .bold : .regular)
                                }

                                // Connection targets
                                ForEach(targets, id: \.self) { targetId in
                                    let targetLabel = nodeLabels[targetId] ?? targetId
                                    Text("  \u{2514}\u{2500}\u{2500}\u{2192} \(targetLabel)")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                        .padding(.leading, 16)
                                }
                            }
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(isSelected ? Color.accentColor.opacity(0.1) : Color(.systemBackground))
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color(.systemGray4), lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(node.type): \(node.label)")
                    }
                }
            }

            if nodes.isEmpty {
                Text("(empty workflow)")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .padding(16)
            }

            SwiftUI.Button(action: onAddNode) {
                HStack {
                    Image(systemName: "plus")
                    Text("Add Node")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
        }
        .padding(8)
    }
}
