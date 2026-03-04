// ============================================================
// Clef Surface SwiftUI Widget — GraphView
//
// Force-directed node-and-edge graph visualization. Nodes are
// drawn as circles with labels on a Canvas, connected by edge
// lines. Supports node selection and keyboard/tap navigation.
// ============================================================

import SwiftUI

struct GraphNode: Identifiable {
    let id: String
    let label: String
}

struct GraphEdge: Identifiable {
    var id: String { "\(from)->\(to)" }
    let from: String
    let to: String
    var label: String? = nil
}

struct GraphViewWidget: View {
    var nodes: [GraphNode]
    var edges: [GraphEdge]
    var selectedNode: String? = nil
    var canvasHeight: CGFloat = 200
    var onSelectNode: (String) -> Void = { _ in }

    var body: some View {
        let adjacency: [String: [(String, String?)]] = {
            var adj = [String: [(String, String?)]]()
            for edge in edges {
                adj[edge.from, default: []].append((edge.to, edge.label))
            }
            return adj
        }()
        let nodeLabels = Dictionary(uniqueKeysWithValues: nodes.map { ($0.id, $0.label) })

        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Graph")
                    .font(.headline)
                    .fontWeight(.bold)
                Text("(\(nodes.count) nodes, \(edges.count) edges)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            // Canvas visualization
            Canvas { context, size in
                guard !nodes.isEmpty else { return }

                let centerX = size.width / 2
                let centerY = size.height / 2
                let radius = min(centerX, centerY) * 0.7
                let nodeRadius: CGFloat = 20

                // Position nodes in a circle
                let positions: [String: CGPoint] = Dictionary(uniqueKeysWithValues:
                    nodes.enumerated().map { index, node in
                        let angle = (2 * .pi * CGFloat(index) / CGFloat(nodes.count)) - .pi / 2
                        return (node.id, CGPoint(
                            x: centerX + radius * cos(angle),
                            y: centerY + radius * sin(angle)
                        ))
                    }
                )

                // Draw edges
                for edge in edges {
                    guard let from = positions[edge.from], let to = positions[edge.to] else { continue }
                    var path = Path()
                    path.move(to: from)
                    path.addLine(to: to)
                    context.stroke(path, with: .color(.gray), style: StrokeStyle(lineWidth: 2))
                }

                // Draw nodes
                for node in nodes {
                    guard let pos = positions[node.id] else { continue }
                    let isSelected = node.id == selectedNode
                    let fillColor: Color = isSelected ? Color(red: 0.38, green: 0, blue: 0.93) : Color(red: 0.01, green: 0.85, blue: 0.77)

                    let rect = CGRect(x: pos.x - nodeRadius, y: pos.y - nodeRadius, width: nodeRadius * 2, height: nodeRadius * 2)
                    context.fill(Circle().path(in: rect), with: .color(fillColor))
                    context.stroke(Circle().path(in: rect.insetBy(dx: 3, dy: 3)), with: .color(.white), style: StrokeStyle(lineWidth: 2))
                }
            }
            .frame(height: canvasHeight)

            // Node list
            ForEach(nodes) { node in
                let isSelected = node.id == selectedNode
                let outEdges = adjacency[node.id] ?? []

                SwiftUI.Button(action: { onSelectNode(node.id) }) {
                    HStack {
                        Text("[\(node.label)]")
                            .fontWeight(isSelected ? .bold : .regular)

                        if !outEdges.isEmpty {
                            Text("\u{2192} " + outEdges.map { to, label in
                                let targetLabel = nodeLabels[to] ?? to
                                return "[\(targetLabel)]" + (label != nil ? "(\(label!))" : "")
                            }.joined(separator: ", "))
                            .font(.caption)
                            .foregroundColor(.secondary)
                        }

                        Spacer()
                    }
                    .padding(12)
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
            }

            if nodes.isEmpty {
                Text("(empty graph)")
                    .font(.body)
                    .foregroundColor(.secondary)
            }
        }
        .padding(8)
    }
}
